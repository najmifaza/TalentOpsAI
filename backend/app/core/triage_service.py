import asyncio
import hashlib
import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.broadcaster import sse_broadcaster
from app.core.state import DistributedSemaphore
from app.core.llm_adapter import LLMAdapter, compute_file_hash
from app.core.prompt import build_extraction_prompt, clean_llm_json_response
from app.core.scoring import DeterministicScoringEngine
from app.core.hidden_text_detector import audit_docx_hidden_text
from app.schemas.extraction import CandidateExtractionSchema, AnomalyFlags
from app.adapters.github import GitHubAdapter
from app.adapters.calendar import MockCalendarAdapter

logger = logging.getLogger(__name__)

# Concurrency limiter to avoid throttling the LLM gateway.
# Redis-backed when REDIS_URL is reachable, so the limit is enforced across all
# Uvicorn workers instead of per-process (see app/core/state.py).
triage_semaphore = DistributedSemaphore("triage", limit=settings.TRIAGE_CONCURRENCY_LIMIT)


class AgentTriageService:
    """
    Orchestrates the 7 Autonomous Agent Execution Cycles (PRD Bab 5.3):
    1. Ingestion & Sanitization Verification
    2. Hidden-Text & Prompt Injection Scan
    3. Structured Information Extraction (Gemini 3.8 via 9router)
    4. Anti-Hallucination Substring Guard Audit
    5. Portfolio & GitHub REST API v3 Verification
    6. Deterministic 4D Scoring & Timeline Audit
    7. Adaptive Assessment Synthesis & Tentative Calendar Locking
    """

    def __init__(self):
        self.llm_adapter = LLMAdapter()
        self.github_adapter = GitHubAdapter()
        self.calendar_adapter = MockCalendarAdapter()

    async def execute_triage(
        self,
        candidate_id: int,
        db: AsyncSession,
        use_cache: bool = True,
    ) -> Dict[str, Any]:
        """Runs governed on-demand triage for a single candidate."""
        async with triage_semaphore.lease():
            run_id = str(uuid.uuid4())
            start_total = time.time()

            # 1. Fetch Candidate & Job Details
            cand_res = await db.execute(
                text("""
                    SELECT c.id, c.job_id, c.masked_identifier, c.sanitized_resume_text,
                           c.file_hash_sha256, c.resume_file_path, c.status,
                           c.github_url, c.portfolio_url,
                           j.title as job_title, j.department, j.core_competencies, j.weight_config,
                           j.is_tech_role, j.competency_taxonomies
                    FROM candidates c
                    JOIN job_descriptions j ON c.job_id = j.id
                    WHERE c.id = :id AND c.is_deleted = FALSE
                """),
                {"id": candidate_id},
            )
            candidate = cand_res.mappings().first()
            if not candidate:
                raise ValueError(f"Candidate {candidate_id} not found or deleted")

            masked_id = candidate["masked_identifier"]
            sanitized_text = candidate["sanitized_resume_text"] or ""
            file_hash = candidate["file_hash_sha256"] or compute_file_hash(sanitized_text)

            is_tech_role = bool(candidate["is_tech_role"]) if "is_tech_role" in candidate.keys() and candidate["is_tech_role"] is not None else True
            comp_tax = candidate["competency_taxonomies"] if "competency_taxonomies" in candidate.keys() else None
            if isinstance(comp_tax, str):
                try:
                    comp_tax = json.loads(comp_tax)
                except Exception:
                    comp_tax = None
            job_title = candidate.get("job_title") or "Posisi"

            core_competencies: List[str] = candidate["core_competencies"]
            if isinstance(core_competencies, str):
                try:
                    core_competencies = json.loads(core_competencies)
                except Exception:
                    core_competencies = ["FastAPI", "Docker", "PostgreSQL", "CI/CD", "Redis"]

            weights: Dict[str, float] = candidate["weight_config"]
            if isinstance(weights, str):
                try:
                    weights = json.loads(weights)
                except Exception:
                    weights = {"SKILL": 0.4, "EXPERIENCE": 0.3, "EDUCATION": 0.1, "PORTFOLIO": 0.2}

            # Update status to analyzing
            await db.execute(
                text("UPDATE candidates SET status = 'analyzing' WHERE id = :id"),
                {"id": candidate_id},
            )
            await db.commit()

            # Broadcast start
            await sse_broadcaster.publish(
                candidate_id,
                step_name="triage_initiated",
                status="started",
                details={"masked_identifier": masked_id, "run_id": run_id},
            )

            # ==================================================================
            # STEP 1 & 2: Ingestion, Hidden Text & Injection Audit
            # ==================================================================
            t0 = time.time()
            hidden_detected = False
            hidden_snippets = []

            # Check existing recorded anomalies from upload
            existing_anom_res = await db.execute(
                text("SELECT anomaly_type, description FROM candidate_anomalies WHERE candidate_id = :id"),
                {"id": candidate_id},
            )
            existing_anoms = [dict(a) for a in existing_anom_res.mappings()]
            for ea in existing_anoms:
                if ea["anomaly_type"] in ("PROMPT_INJECTION", "HIDDEN_TEXT") or ea["anomaly_type"].startswith("SECURITY_QUARANTINE"):
                    hidden_detected = True
                    hidden_snippets.append(ea["description"])

            dur_ms = int((time.time() - t0) * 1000)
            await self._record_step(
                db, run_id, candidate_id, masked_id, "hidden_text_audit",
                "completed", dur_ms, {"hidden_detected": hidden_detected}
            )
            await sse_broadcaster.publish(
                candidate_id, "hidden_text_audit", "completed",
                {"hidden_detected": hidden_detected, "snippets_count": len(hidden_snippets)}
            )

            # ==================================================================
            # STEP 3: Structured LLM Extraction (Gemini 3.8 via 9router)
            # ==================================================================
            t0 = time.time()
            prompt_msgs = build_extraction_prompt(sanitized_text)

            extraction_error = None
            try:
                llm_resp = await self.llm_adapter.complete(
                    messages=prompt_msgs,
                    file_hash=file_hash,
                    use_cache=use_cache,
                )
                clean_json_str = clean_llm_json_response(llm_resp["content"])
                extracted_dict = json.loads(clean_json_str)
                schema = CandidateExtractionSchema.model_validate(extracted_dict)
                extraction_source = llm_resp.get("source", "LIVE")
            except Exception as e:
                extraction_error = str(e)
                logger.warning(f"Live extraction failed for {candidate_id}, using heuristic fallback: {e}")
                # Safe fallback schema
                schema = CandidateExtractionSchema(
                    claims=[],
                    career_timeline=[],
                    anomalies=AnomalyFlags(prompt_injection_detected=False, hidden_text_detected=hidden_detected),
                )
                extraction_source = "FALLBACK"

            dur_ms = int((time.time() - t0) * 1000)
            step_details = {
                "source": extraction_source,
                "claims_count": len(schema.claims),
            }
            if extraction_error:
                step_details["llm_gateway_error"] = extraction_error

            await self._record_step(
                db, run_id, candidate_id, masked_id, "llm_extraction",
                "completed", dur_ms, step_details
            )
            await sse_broadcaster.publish(
                candidate_id, "llm_extraction", "completed",
                step_details
            )

            # ==================================================================
            # STEP 4: Anti-Hallucination Substring Guard
            # ==================================================================
            t0 = time.time()
            schema.apply_substring_guard(sanitized_text)
            verified_claims_count = sum(1 for c in schema.claims if c.has_implementation_detail)
            dur_ms = int((time.time() - t0) * 1000)

            await self._record_step(
                db, run_id, candidate_id, masked_id, "substring_guard_audit",
                "completed", dur_ms, {"verified_claims": verified_claims_count}
            )
            await sse_broadcaster.publish(
                candidate_id, "substring_guard_audit", "completed",
                {"verified_claims": verified_claims_count, "total_claims": len(schema.claims)}
            )

            # ==================================================================
            # STEP 5: Portfolio & GitHub REST API v3 Verification
            # ==================================================================
            t0 = time.time()
            verified_repos = {}
            if is_tech_role:
                candidate_github_url = schema.github_url or candidate.get("github_url")

                # Search repo URLs in claims
                for claim in schema.claims:
                    if claim.repo_url and claim.repo_url not in verified_repos:
                        repo_audit = await self.github_adapter.verify_repository(claim.repo_url)
                        verified_repos[claim.repo_url] = repo_audit

                if candidate_github_url and candidate_github_url not in verified_repos:
                    if "/repos/" not in candidate_github_url and candidate_github_url.count("/") == 4:
                        # Specific repo format
                        repo_audit = await self.github_adapter.verify_repository(candidate_github_url)
                        verified_repos[candidate_github_url] = repo_audit

            dur_ms = int((time.time() - t0) * 1000)
            status_step = "completed" if is_tech_role else "skipped_non_tech"
            await self._record_step(
                db, run_id, candidate_id, masked_id, "github_repo_verification",
                status_step, dur_ms, {"repos_verified": len(verified_repos), "is_tech_role": is_tech_role}
            )
            await sse_broadcaster.publish(
                candidate_id, "github_repo_verification", status_step,
                {"repos_verified": len(verified_repos), "repos": list(verified_repos.keys()), "is_tech_role": is_tech_role}
            )

            # ==================================================================
            # STEP 6: Deterministic 4D Scoring & Timeline Audit
            # ==================================================================
            t0 = time.time()
            anomalies_dict = schema.anomalies.model_dump()
            if hidden_detected:
                anomalies_dict["hidden_text_detected"] = True

            assessment = DeterministicScoringEngine.compute_full_assessment(
                claims=[c.model_dump() for c in schema.claims],
                career_timeline=[t.model_dump() for t in schema.career_timeline],
                education=schema.education.model_dump() if schema.education else None,
                anomalies=anomalies_dict,
                core_competencies=core_competencies,
                verified_repos=verified_repos,
                weights=weights,
                is_programmer_role=is_tech_role,
                portfolio_url=schema.portfolio_url or candidate.get("portfolio_url"),
                competency_taxonomies=comp_tax,
                job_title=job_title,
            )
            dur_ms = int((time.time() - t0) * 1000)

            await self._record_step(
                db, run_id, candidate_id, masked_id, "deterministic_scoring",
                "completed", dur_ms, {"overall_score": assessment["overall_score"]}
            )
            await sse_broadcaster.publish(
                candidate_id, "deterministic_scoring", "completed",
                {
                    "overall_score": assessment["overall_score"],
                    "dimension_scores": assessment["dimension_scores"],
                    "recommendation": assessment["recommendation"],
                    "confidence": assessment["confidence_level"],
                    "risk": assessment["unresolved_risk"],
                }
            )

            # ==================================================================
            # STEP 7: Adaptive Assessments & Tentative Calendar Lock
            # ==================================================================
            t0 = time.time()
            calendar_reserved = False
            reserved_slot_id = None

            # Persist Evidence
            await db.execute(text("DELETE FROM candidate_evidence WHERE candidate_id = :id"), {"id": candidate_id})
            # Re-triage must replace, not append: without this every run duplicated
            # the same anomaly rows and the graph showed the same finding N times.
            await db.execute(text("DELETE FROM candidate_anomalies WHERE candidate_id = :id"), {"id": candidate_id})
            for ev in assessment["evidence_records"]:
                await db.execute(
                    text("""
                        INSERT INTO candidate_evidence (
                            candidate_id, dimension, target_competency, matched_requirement,
                            claim_text, evidence_source, score_contribution, confidence, verified
                        ) VALUES (
                            :cid, :dim, :comp, :req, :claim, :src, :score, :conf, :verified
                        )
                    """),
                    {
                        "cid": candidate_id,
                        "dim": ev["dimension"],
                        "comp": ev.get("target_competency"),
                        "req": ev.get("matched_requirement"),
                        "claim": ev["claim_text"],
                        "src": ev["evidence_source"],
                        "score": ev["score_contribution"],
                        "conf": ev["confidence"],
                        "verified": 1 if ev.get("verified") else 0,
                    },
                )

            # Persist Anomalies. Prefer the structured detail from the scoring engine:
            # a bare flag code ("CONCURRENT_FULLTIME_OVERLAP_23_MONTHS") tells a recruiter
            # nothing about which two jobs collided or what to ask the candidate.
            anomaly_details = assessment.get("anomaly_details") or []
            if anomaly_details:
                for detail in anomaly_details:
                    await db.execute(
                        text("""
                            INSERT INTO candidate_anomalies (
                                candidate_id, anomaly_type, severity, description, suggested_verification
                            ) VALUES (
                                :cid, :atype, :sev, :desc, :verify
                            )
                        """),
                        {
                            "cid": candidate_id,
                            "atype": detail.get("type", "ANOMALY"),
                            "sev": detail.get("severity", "MEDIUM"),
                            "desc": detail.get("description") or "Anomali terdeteksi pada berkas.",
                            "verify": detail.get("suggested_verification")
                            or "Konfirmasi temuan ini pada sesi wawancara HR.",
                        },
                    )
            else:
                for a_flag in assessment["anomaly_flags"]:
                    await db.execute(
                        text("""
                            INSERT INTO candidate_anomalies (
                                candidate_id, anomaly_type, severity, description, suggested_verification
                            ) VALUES (
                                :cid, :atype, :sev, :desc, 'Review during HR interview.'
                            )
                        """),
                        {
                            "cid": candidate_id,
                            "atype": a_flag,
                            "sev": "HIGH" if "SECURITY" in a_flag or "OVERLAP" in a_flag else "MEDIUM",
                            "desc": f"Automated risk detection flag: {a_flag}",
                        },
                    )

            # Persist Adaptive Assessments
            await db.execute(text("DELETE FROM candidate_assessments WHERE candidate_id = :id"), {"id": candidate_id})
            for challenge in assessment["adaptive_challenges"]:
                await db.execute(
                    text("""
                        INSERT INTO candidate_assessments (
                            candidate_id, target_skill, difficulty_level, scenario_question, evaluation_criteria
                        ) VALUES (
                            :cid, :skill, :diff, :q, :crit
                        )
                    """),
                    {
                        "cid": candidate_id,
                        "skill": challenge["target_skill"],
                        "diff": challenge["difficulty_level"],
                        "q": challenge["scenario_question"],
                        "crit": challenge["evaluation_criteria"],
                    },
                )

            # Tentative Calendar Lock for STRONG_MATCH candidates
            if assessment["recommendation"] == "STRONG_MATCH":
                # Find available slot
                avail_res = await db.execute(
                    text("SELECT id, interviewer_id FROM interview_slots WHERE status = 'available' ORDER BY start_time ASC LIMIT 1")
                )
                slot_row = avail_res.mappings().first()
                if slot_row:
                    reserve_result = await self.calendar_adapter.reserve_slot(
                        db=db,
                        slot_id=slot_row["id"],
                        candidate_id=candidate_id,
                        interviewer_id=slot_row["interviewer_id"],
                    )
                    if reserve_result.get("success"):
                        calendar_reserved = True
                        reserved_slot_id = slot_row["id"]

            # Final Candidate Status Update
            next_status = "waiting_approval"
            await db.execute(
                text("""
                    UPDATE candidates
                    SET overall_score = :overall,
                        dimension_scores = :dims,
                        confidence_level = :conf,
                        unresolved_risk = :risk,
                        recommendation = :rec,
                        triage_priority = :prio,
                        status = :status,
                        github_url = COALESCE(:github, github_url),
                        portfolio_url = COALESCE(:port, portfolio_url)
                    WHERE id = :id
                """),
                {
                    "overall": assessment["overall_score"],
                    "dims": json.dumps(assessment["dimension_scores"]),
                    "conf": assessment["confidence_level"],
                    "risk": assessment["unresolved_risk"],
                    "rec": assessment["recommendation"],
                    "prio": assessment["triage_priority"],
                    "status": next_status,
                    "github": schema.github_url,
                    "port": schema.portfolio_url,
                    "id": candidate_id,
                },
            )
            await db.commit()

            dur_ms = int((time.time() - t0) * 1000)
            await self._record_step(
                db, run_id, candidate_id, masked_id, "triage_finalized",
                "completed", dur_ms, {
                    "calendar_reserved": calendar_reserved,
                    "slot_id": reserved_slot_id,
                    "recommendation": assessment["recommendation"],
                }
            )
            await sse_broadcaster.publish(
                candidate_id, "triage_completed", "completed",
                {
                    "overall_score": assessment["overall_score"],
                    "recommendation": assessment["recommendation"],
                    "priority": assessment["triage_priority"],
                    "calendar_reserved": calendar_reserved,
                    "status": next_status,
                }
            )

            total_ms = int((time.time() - start_total) * 1000)
            logger.info(f"Triage for {masked_id} completed in {total_ms} ms with recommendation {assessment['recommendation']}")

            return {
                "candidate_id": candidate_id,
                "masked_identifier": masked_id,
                "run_id": run_id,
                "overall_score": assessment["overall_score"],
                "dimension_scores": assessment["dimension_scores"],
                "confidence_level": assessment["confidence_level"],
                "unresolved_risk": assessment["unresolved_risk"],
                "recommendation": assessment["recommendation"],
                "triage_priority": assessment["triage_priority"],
                "calendar_reserved": calendar_reserved,
                "total_duration_ms": total_ms,
            }

    async def _record_step(
        self,
        db: AsyncSession,
        run_id: str,
        candidate_id: int,
        masked_id: str,
        step_name: str,
        status: str,
        dur_ms: int,
        payload_output: Optional[dict] = None,
    ):
        """Records append-only agent step to database audit table."""
        try:
            await db.execute(
                text("""
                    INSERT INTO agent_steps (
                        run_id, candidate_id, masked_identifier, step_name,
                        status, payload_output, duration_ms
                    ) VALUES (
                        :run_id, :cid, :mid, :step, :status, :output, :dur
                    )
                """),
                {
                    "run_id": run_id,
                    "cid": candidate_id,
                    "mid": masked_id,
                    "step": step_name,
                    "status": status,
                    "output": json.dumps(payload_output or {}),
                    "dur": dur_ms,
                },
            )
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to record agent step {step_name}: {e}")


agent_triage_service = AgentTriageService()
