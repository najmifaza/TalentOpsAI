import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, BackgroundTasks, Query
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text, bindparam
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db, AsyncSessionLocal
from app.core.auth import require_roles
from app.core.triage_service import agent_triage_service
from app.core.crypto import (
    generate_dek,
    encrypt_dek,
    decrypt_dek,
    encrypt_pii,
    decrypt_pii,
    compute_blind_index,
    generate_tombstone_hash,
)
from app.core.sanitizer import sanitize_resume
from app.core.hidden_text_detector import audit_docx_hidden_text, audit_document_hidden_text
from app.core.file_parser import (
    validate_file_magic_bytes,
    extract_text_from_file,
    generate_masked_identifier,
    generate_tracking_token,
    mask_name,
    save_resume_bytes,
    resolve_resume_file,
    delete_resume_file,
)
from app.core.erasure import execute_talentops_erasure
from app.core.broadcaster import sse_broadcaster
from app.core.email import email_service
from app.core.email_templates import interview_scheduled, application_status_update
from app.adapters.calendar import mock_calendar_adapter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/candidates", tags=["HR Recruiter Candidate Management"])

STATUS_LABELS = {
    "APPROVED_DISPATCH": "Disetujui - Tahap Wawancara",
    "REQUEST_INFO": "Menunggu Informasi Tambahan",
    "OVERRIDE_REJECT": "Tidak Dilanjutkan",
    "REJECT_CONFIRMED": "Tidak Dilanjutkan",
}


async def _sync_calendar_booking(
    db: AsyncSession,
    reviewer_id: int,
    slot_id: int,
    candidate_id: int,
    candidate: dict,
    job_title: str,
) -> dict:
    """
    Menghasilkan metadata jadwal wawancara terkonfirmasi beserta URL ekspor instan
    ke Google Calendar pribadi (1-click template URL tanpa OAuth).
    """
    try:
        slot_res = await db.execute(
            text("SELECT start_time, end_time, interviewer_id FROM interview_slots WHERE id = :sid"),
            {"sid": slot_id},
        )
        slot = slot_res.mappings().first()
        if not slot:
            return {"synced": False, "reason": "SLOT_NOT_FOUND", "adapter": "sovereign_calendar"}

        interviewer_name = ""
        try:
            int_res = await db.execute(
                text("SELECT username FROM users WHERE id = :uid"),
                {"uid": slot["interviewer_id"]},
            )
            int_row = int_res.mappings().first()
            if int_row:
                interviewer_name = int_row["username"]
        except Exception:
            pass

        start_time = slot["start_time"]
        end_time = slot["end_time"]
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time)
        if isinstance(end_time, str):
            end_time = datetime.fromisoformat(end_time)

        cand_id_str = candidate.get("masked_identifier", f"#{candidate_id}")
        summary = f"Wawancara {job_title} - {cand_id_str}"
        description = (
            f"Kandidat: {cand_id_str}\n"
            f"Posisi: {job_title}\n"
            f"Pewawancara: {interviewer_name or '-'}\n"
            f"Slot ID: {slot_id}\n"
            "Diselenggarakan melalui TalentOps AI."
        )

        google_url = mock_calendar_adapter.generate_google_calendar_url(
            summary=summary,
            start_time=start_time,
            end_time=end_time,
            description=description,
        )
        event_id = mock_calendar_adapter.generate_event_id(slot_id, candidate_id)

        return {
            "synced": True,
            "adapter": "sovereign_calendar",
            "event_id": event_id,
            "export_google_url": google_url,
            "reason": None,
        }
    except Exception as exc:
        logger.warning("Calendar sync failed for slot %s: %s", slot_id, type(exc).__name__)
        return {"synced": False, "adapter": "sovereign_calendar", "reason": "CALENDAR_SYNC_ERROR"}


async def _notify_candidate_decision(
    candidate: dict,
    job_title: str,
    decision: str,
    slot_id: Optional[int],
    notes: Optional[str],
) -> dict:
    """
    Emails the applicant about a final human decision.

    The recipient address is decrypted from the candidate's envelope here and is
    never logged or returned in the response body.
    """
    if not email_service.configured:
        return {"sent": False, "reason": "EMAIL_NOT_CONFIGURED"}

    try:
        dek = decrypt_dek(candidate["encrypted_dek"])
        recipient = decrypt_pii(candidate["encrypted_email"], dek) if candidate["encrypted_email"] else ""
    except Exception as exc:
        logger.warning("Cannot decrypt candidate email for notification: %s", type(exc).__name__)
        return {"sent": False, "reason": "RECIPIENT_DECRYPT_FAILED"}

    if not recipient:
        return {"sent": False, "reason": "NO_RECIPIENT_ADDRESS"}

    masked = candidate["masked_identifier"]

    if decision == "APPROVED_DISPATCH" and slot_id is not None:
        subject, html, text_body = interview_scheduled(
            masked_identifier=masked,
            job_title=job_title,
            start_time="(lihat detail di portal)",
            end_time="(lihat detail di portal)",
            meeting_note=notes or "",
        )
    else:
        subject, html, text_body = application_status_update(
            masked_identifier=masked,
            job_title=job_title,
            status_label=STATUS_LABELS.get(decision, decision),
            note=notes or "",
        )

    result = await email_service.send(recipient, subject, html, text_body)
    return {
        "sent": bool(result.get("sent")),
        "provider": result.get("provider"),
        "reason": result.get("reason"),
    }


@router.get("")
async def list_candidates(
    job_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager", "compliance_officer")),
):
    """
    Lists candidates for HR Recruiter Dashboard.
    Omits plaintext PII; displays masked_identifier and evaluation stats.

    Payload contract consumed by the dashboard table:
    `job_title`, `department`, `github_url`, `portfolio_url`, `flags`, and
    `key_technologies` are included so the UI never needs mock data. `flags` is
    derived from `candidate_anomalies` and `key_technologies` from
    `candidate_evidence`, both fetched in one batched query per relation to
    avoid an N+1 pattern across the page.
    """
    query_str = """
        SELECT c.id, c.job_id, c.masked_identifier, c.tracking_token, c.overall_score,
               c.confidence_level, c.unresolved_risk, c.recommendation, c.triage_priority,
               c.status, c.dimension_scores, c.is_deleted, c.created_at,
               c.github_url, c.portfolio_url,
               j.title AS job_title, j.department AS job_department
        FROM candidates c
        JOIN job_descriptions j ON c.job_id = j.id
        WHERE c.is_deleted = FALSE
    """
    params = {}
    if job_id:
        query_str += " AND c.job_id = :job_id"
        params["job_id"] = job_id
    if status:
        query_str += " AND c.status = :status"
        params["status"] = status

    query_str += " ORDER BY c.triage_priority DESC, c.created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    res = await db.execute(text(query_str), params)
    raw_rows = list(res.mappings())

    # Batch-fetch relation data for the page (single query each, not per row)
    candidate_ids = [r["id"] for r in raw_rows]
    flags_by_candidate: dict[int, list[str]] = {}
    techs_by_candidate: dict[int, list[str]] = {}

    if candidate_ids:
        anom_stmt = text(
            "SELECT candidate_id, anomaly_type FROM candidate_anomalies "
            "WHERE candidate_id IN :cids ORDER BY candidate_id, anomaly_type"
        ).bindparams(bindparam("cids", expanding=True))
        anom_res = await db.execute(anom_stmt, {"cids": candidate_ids})
        for row in anom_res.mappings():
            flags_by_candidate.setdefault(row["candidate_id"], []).append(row["anomaly_type"])

        ev_stmt = text(
            "SELECT candidate_id, target_competency FROM candidate_evidence "
            "WHERE candidate_id IN :cids AND target_competency IS NOT NULL "
            "ORDER BY candidate_id, target_competency"
        ).bindparams(bindparam("cids", expanding=True))
        ev_res = await db.execute(ev_stmt, {"cids": candidate_ids})
        for row in ev_res.mappings():
            bucket = techs_by_candidate.setdefault(row["candidate_id"], [])
            tech = row["target_competency"]
            if tech and tech not in bucket:
                bucket.append(tech)

    rows = []
    for r in raw_rows:
        dim = r["dimension_scores"]
        if isinstance(dim, str):
            try:
                dim = json.loads(dim)
            except Exception:
                dim = {}
        rows.append({
            "id": r["id"],
            "job_id": r["job_id"],
            "job_title": r["job_title"],
            "department": r["job_department"],
            "masked_identifier": r["masked_identifier"],
            "tracking_token": r["tracking_token"],
            "overall_score": float(r["overall_score"]) if r["overall_score"] is not None else None,
            "confidence_level": r["confidence_level"],
            "unresolved_risk": r["unresolved_risk"],
            "recommendation": r["recommendation"],
            "triage_priority": r["triage_priority"],
            "status": r["status"],
            "dimension_scores": dim,
            "github_url": r["github_url"],
            "portfolio_url": r["portfolio_url"],
            "flags": flags_by_candidate.get(r["id"], []),
            "key_technologies": techs_by_candidate.get(r["id"], []),
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        })
    return {"data": rows, "count": len(rows)}


@router.get("/{candidate_id}")
async def get_candidate_dossier(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager", "compliance_officer")),
):
    """Retrieves full candidate dossier, anomalies, evidence, and assessments."""
    cand_res = await db.execute(
        text("SELECT * FROM candidates WHERE id = :id AND is_deleted = FALSE"),
        {"id": candidate_id},
    )
    cand = cand_res.mappings().first()
    if not cand:
        raise HTTPException(status_code=404, detail="CANDIDATE_NOT_FOUND")

    # Fetch anomalies
    anom_res = await db.execute(
        text("SELECT id, anomaly_type, severity, description, suggested_verification FROM candidate_anomalies WHERE candidate_id = :id"),
        {"id": candidate_id},
    )
    anomalies = [dict(a) for a in anom_res.mappings()]

    # Fetch evidence items
    ev_res = await db.execute(
        text("SELECT id, dimension, target_competency, matched_requirement, claim_text, evidence_source, score_contribution, confidence, verified FROM candidate_evidence WHERE candidate_id = :id ORDER BY verified DESC, score_contribution DESC, id"),
        {"id": candidate_id},
    )
    evidence = [dict(e) for e in ev_res.mappings()]

    # Fetch assessments
    ass_res = await db.execute(
        text("SELECT id, target_skill, difficulty_level, scenario_question, evaluation_criteria FROM candidate_assessments WHERE candidate_id = :id"),
        {"id": candidate_id},
    )
    assessments = [dict(ass) for ass in ass_res.mappings()]

    # Fetch interview slot if already booked or scheduled
    slot_res = await db.execute(
        text("""
            SELECT s.id, s.start_time, s.end_time, s.status, s.external_calendar_event_id,
                   u.username as interviewer_name
            FROM interview_slots s
            JOIN users u ON s.interviewer_id = u.id
            WHERE s.candidate_id = :id AND s.status = 'booked'
            ORDER BY s.id DESC LIMIT 1
        """),
        {"id": candidate_id},
    )
    scheduled_slot = slot_res.mappings().first()
    scheduled_interview = None
    if scheduled_slot:
        st_dt = scheduled_slot["start_time"]
        et_dt = scheduled_slot["end_time"]
        if isinstance(st_dt, str):
            st_dt = datetime.fromisoformat(st_dt)
        if isinstance(et_dt, str):
            et_dt = datetime.fromisoformat(et_dt)
        cand_label = cand.get("masked_name_hint") or cand.get("masked_identifier") or f"#{cand['id']}"
        summary = f"Wawancara Teknis - {cand_label}"
        desc = (
            f"Kandidat: {cand_label}\n"
            f"Status: {cand['status']}\n"
            f"Pewawancara: {scheduled_slot['interviewer_name']}\n"
            f"Slot ID: {scheduled_slot['id']}\n"
            "Diselenggarakan melalui TalentOps AI."
        )
        google_url = mock_calendar_adapter.generate_google_calendar_url(
            summary=summary,
            start_time=st_dt,
            end_time=et_dt,
            description=desc,
        )
        scheduled_interview = {
            "slot_id": scheduled_slot["id"],
            "start_time": st_dt.isoformat(),
            "end_time": et_dt.isoformat(),
            "status": scheduled_slot["status"],
            "interviewer_name": scheduled_slot["interviewer_name"],
            "event_id": scheduled_slot["external_calendar_event_id"],
            "export_google_url": google_url,
        }

    job_res = await db.execute(
        text("SELECT id, title, department, is_tech_role FROM job_descriptions WHERE id = :jid"),
        {"jid": cand["job_id"]},
    )
    job_info = job_res.mappings().first()

    return {
        "candidate": {
            "id": cand["id"],
            "job_id": cand["job_id"],
            "job_title": job_info["title"] if job_info else None,
            "is_tech_role": bool(job_info["is_tech_role"]) if job_info and job_info.get("is_tech_role") is not None else True,
            "masked_identifier": cand["masked_identifier"],
            "status": cand["status"],
            "triage_priority": cand["triage_priority"],
            "overall_score": float(cand["overall_score"]) if cand["overall_score"] is not None else None,
            "dimension_scores": cand["dimension_scores"] if isinstance(cand["dimension_scores"], dict) else json.loads(cand["dimension_scores"] or "{}") if isinstance(cand["dimension_scores"], str) else {},
            "confidence_level": cand["confidence_level"],
            "unresolved_risk": cand["unresolved_risk"],
            "recommendation": cand["recommendation"],
            "github_url": cand["github_url"],
            "portfolio_url": cand["portfolio_url"],
            "masked_name_hint": cand.get("masked_name_hint"),
            "resume_file_available": bool(resolve_resume_file(cand["resume_file_path"])),
            "resume_file_format": ((cand["resume_file_path"] or "").rsplit(".", 1)[-1].lower() or None),
            "sanitized_resume_text": cand["sanitized_resume_text"],
            "created_at": cand["created_at"].isoformat() if cand["created_at"] else None,
        },
        "anomalies": anomalies,
        "evidence": evidence,
        "assessments": assessments,
        "scheduled_interview": scheduled_interview,
    }


def _parse_applicant_meta(raw: Optional[str], file_count: int) -> Optional[List[Dict[str, str]]]:
    """Validates the dropzone's per-file identity payload.

    Returns None when the caller sent nothing (legacy placeholder behaviour),
    otherwise a list aligned with the uploaded files.
    """
    if raw is None or not raw.strip():
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="APPLICANT_META_NOT_JSON")
    if not isinstance(parsed, list):
        raise HTTPException(status_code=400, detail="APPLICANT_META_NOT_ARRAY")
    if len(parsed) != file_count:
        raise HTTPException(
            status_code=400,
            detail=f"APPLICANT_META_COUNT_MISMATCH: {len(parsed)} entri untuk {file_count} berkas",
        )

    cleaned: List[Dict[str, str]] = []
    for position, entry in enumerate(parsed, start=1):
        if not isinstance(entry, dict):
            raise HTTPException(status_code=400, detail=f"APPLICANT_META_ENTRY_{position}_NOT_OBJECT")
        name = str(entry.get("name") or "").strip()
        email = str(entry.get("email") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail=f"APPLICANT_META_ENTRY_{position}_NAME_REQUIRED")
        if "@" not in email or len(email) < 5:
            raise HTTPException(status_code=400, detail=f"APPLICANT_META_ENTRY_{position}_EMAIL_INVALID")
        cleaned.append({"name": name, "email": email})
    return cleaned


@router.post("/upload")
async def hr_direct_upload(
    job_id: int = Form(...),
    files: List[UploadFile] = File(...),
    applicant_meta: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter")),
):
    """
    HR direct multi-file dropzone for candidate resumes.
    Parses files in-memory, applies rule-based heuristic sanitization,
    encrypts data, and inserts into candidates table with initial status 'queued'.

    `applicant_meta` is an optional JSON array aligned with `files` by index:
    `[{"name": "...", "email": "..."}, ...]`. When supplied, the applicant's real
    identity is encrypted and stored, so review emails reach the applicant and the
    unmask endpoint shows a real name. Without it the legacy placeholders are kept
    (`Applicant-<filename>` / an internal address) and the response says so.
    """
    job_check = await db.execute(
        text("SELECT id FROM job_descriptions WHERE id = :id AND status = 'active'"),
        {"id": job_id},
    )
    if not job_check.first():
        raise HTTPException(status_code=404, detail="JOB_NOT_FOUND_OR_CLOSED")

    meta_list = _parse_applicant_meta(applicant_meta, len(files))

    uploaded = []
    for index, file in enumerate(files):
        file_bytes = await file.read()
        file_format = validate_file_magic_bytes(file_bytes, file.filename or "")
        file_hash = hashlib.sha256(file_bytes).hexdigest()

        raw_text = extract_text_from_file(file_bytes, file_format)

        hidden_text_detected = False
        hidden_snippets: list[str] = []
        cleaned_body, hidden_snippets, pdf_audit = audit_document_hidden_text(
            file_bytes, file_format
        )
        if hidden_snippets:
            hidden_text_detected = True
            raw_text = cleaned_body
        elif pdf_audit is not None and pdf_audit.visible_text.strip():
            raw_text = cleaned_body

        meta = meta_list[index] if meta_list else None
        # Form metadata turns the sanitizer into exact dictionary matching instead of
        # header heuristics, so pass it through rather than redacting after the fact.
        sanitize_result = sanitize_resume(
            raw_text,
            known_name=meta["name"] if meta else None,
            known_email=meta["email"] if meta else None,
        )
        sanitized_text = sanitize_result.text
        sanitize_stats = sanitize_result.stats

        candidate_dek = generate_dek()
        enc_dek = encrypt_dek(candidate_dek)
        if meta:
            enc_name = encrypt_pii(meta["name"], candidate_dek)
            enc_email = encrypt_pii(meta["email"], candidate_dek)
            email_blind_idx = compute_blind_index(meta["email"])
            identity_source = "form"
        else:
            # Legacy path: no metadata supplied, so keep the old placeholders.
            enc_name = encrypt_pii(f"Applicant-{file.filename}", candidate_dek)
            enc_email = encrypt_pii("hr_dropzone_upload@talentops.internal", candidate_dek)
            email_blind_idx = compute_blind_index(f"{file_hash}@talentops.internal")
            identity_source = "placeholder"

        masked_id = generate_masked_identifier()
        tracking_token = generate_tracking_token()
        stored_name = save_resume_bytes(file_bytes, file_format)

        res = await db.execute(
            text("""
                INSERT INTO candidates (
                    job_id, encrypted_name, encrypted_email, encrypted_phone, encrypted_dek,
                    email_blind_index, masked_identifier, tracking_token, resume_file_path,
                    file_hash_sha256, sanitized_resume_text, masked_name_hint, status, is_deleted, version
                ) VALUES (
                    :job_id, :enc_name, :enc_email, NULL, :enc_dek,
                    :email_blind_idx, :masked_id, :tracking_token, :file_name,
                    :file_hash, :sanitized_text, :name_hint, 'queued', FALSE, 1
                )
            """),
            {
                "job_id": job_id,
                "enc_name": enc_name,
                "enc_email": enc_email,
                "enc_dek": enc_dek,
                "email_blind_idx": email_blind_idx,
                "masked_id": masked_id,
                "tracking_token": tracking_token,
                "file_name": stored_name,
                "file_hash": file_hash,
                "sanitized_text": sanitized_text,
                "name_hint": mask_name(meta["name"]) if meta else None,
            },
        )
        cand_id = res.lastrowid

        if hidden_text_detected:
            await db.execute(
                text("""
                    INSERT INTO candidate_anomalies (
                        candidate_id, anomaly_type, severity, description, suggested_verification
                    ) VALUES (
                        :cand_id, 'PROMPT_INJECTION', 'HIGH',
                        :desc, 'Review DOCX file for zero-font or vanish XML tags.'
                    )
                """),
                {
                    "cand_id": cand_id,
                    "desc": f"Hidden text / vanish tags detected: {json.dumps(hidden_snippets)}",
                },
            )
            await db.execute(
                text("UPDATE candidates SET triage_priority = 'HIGH_ATTENTION' WHERE id = :id"),
                {"id": cand_id},
            )

        # Record genuine PDF security findings (white text, invisible mode); cosmetic artifacts filtered out
        if pdf_audit is not None and pdf_audit.findings:
            cosmetic_types = {"PDF_MICRO_IMAGE", "PDF_TINY_FONT", "PDF_OFFPAGE_TEXT", "PDF_IMAGE_ONLY_PAGE"}
            grouped_pdf: dict[str, dict] = {}
            for finding in pdf_audit.findings:
                ftype = finding["type"]
                if ftype in cosmetic_types:
                    continue
                entry = grouped_pdf.setdefault(
                    ftype,
                    {"count": 0, "pages": set(), "severity": finding.get("severity", "MEDIUM"), "excerpt": finding.get("excerpt", "")},
                )
                entry["count"] += finding.get("occurrences", 1)
                if finding.get("page") is not None:
                    entry["pages"].add(finding["page"])
                if entry["severity"] != "HIGH":
                    entry["severity"] = finding.get("severity", entry["severity"])

            for ftype, entry in grouped_pdf.items():
                pages = sorted(entry["pages"])
                await db.execute(
                    text("""
                        INSERT INTO candidate_anomalies (
                            candidate_id, anomaly_type, severity, description, suggested_verification
                        ) VALUES (
                            :cand_id, :atype, :sev, :desc, :verify
                        )
                    """),
                    {
                        "cand_id": cand_id,
                        "atype": ftype,
                        "sev": entry["severity"],
                        "desc": (
                            f"{entry['count']} occurrence(s) on page(s) "
                            f"{pages if pages else 'n/a'}: {entry['excerpt']}"
                        ),
                        "verify": "Inspect PDF content stream for invisible text or covert image objects.",
                    },
                )
            if not hidden_text_detected and any(entry["severity"] == "HIGH" for entry in grouped_pdf.values()):
                await db.execute(
                    text("UPDATE candidates SET triage_priority = 'HIGH_ATTENTION' WHERE id = :id"),
                    {"id": cand_id},
                )

        # PRD Bab 6.4: when no form metadata was supplied the dropzone must record any
        # residual PII risk as an anomaly rather than silently accepting it.
        if sanitize_result.has_residual_risk:
            await db.execute(
                text("""
                    INSERT INTO candidate_anomalies (
                        candidate_id, anomaly_type, severity, description, suggested_verification
                    ) VALUES (
                        :cand_id, 'PII_RESIDUAL_RISK', 'MEDIUM',
                        :desc, 'Manually review the resume for unredacted applicant names.'
                    )
                """),
                {
                    "cand_id": cand_id,
                    "desc": (
                        "Possible unredacted name(s) in free narrative: "
                        f"{json.dumps(sanitize_result.residual_name_candidates)}. "
                        f"{' '.join(sanitize_result.limitations)}"
                    ),
                },
            )

        uploaded.append({
            "candidate_id": cand_id,
            "filename": file.filename,
            "masked_identifier": masked_id,
            "status": "queued",
            "identity_source": identity_source,
            "sanitization_stats": sanitize_stats,
            "sanitization": {
                "detected_name": sanitize_result.detected_name,
                "name_source": sanitize_result.name_source,
                "residual_risk": sanitize_result.has_residual_risk,
                "limitations": sanitize_result.limitations,
            },
        })

    await db.commit()
    return {"status": "success", "uploaded_count": len(uploaded), "candidates": uploaded}


@router.post("/{candidate_id}/review")
async def review_candidate(
    candidate_id: int,
    decision: str = Form(...),  # APPROVED_DISPATCH, REQUEST_INFO, OVERRIDE_REJECT, REJECT_CONFIRMED
    notes: Optional[str] = Form(None),
    slot_id: Optional[int] = Form(None),
    interview_date: Optional[str] = Form(None),
    interview_time: Optional[str] = Form(None),
    duration_minutes: int = Form(60),
    reviewer_id: int = Form(1),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager")),
):
    """
    HITL Candidate Review Decision Gatekeeper:
    - Enforces strict transactional lock hierarchy: `users` -> `interview_slots` -> `candidates`.
    - Handles interview slot confirmation if APPROVED_DISPATCH with slot_id or custom date/time.
    - Idempotency guard: decisions are final and interview scheduling only allowed once.
    - Updates candidate status & records append-only decision to human_reviews.
    """
    # Authenticated identity is authoritative over client-supplied reviewer_id
    if isinstance(current_user, dict) and current_user.get("id"):
        reviewer_id = int(current_user["id"])

    valid_decisions = {
        "APPROVED_DISPATCH",
        "REQUEST_INFO",
        "OVERRIDE_REJECT",
        "REJECT_CONFIRMED",
    }
    if decision not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"INVALID_DECISION_MUST_BE_ONE_OF_{list(valid_decisions)}")

    # 1. Lock reviewer in users
    user_res = await db.execute(
        text("SELECT id, role FROM users WHERE id = :uid FOR UPDATE"),
        {"uid": reviewer_id},
    )
    if not user_res.first():
        raise HTTPException(status_code=404, detail="REVIEWER_USER_NOT_FOUND")

    # 2. Lock target slot if slot confirmation requested
    if slot_id is not None:
        slot_res = await db.execute(
            text("SELECT id, status, candidate_id FROM interview_slots WHERE id = :sid FOR UPDATE"),
            {"sid": slot_id},
        )
        slot = slot_res.mappings().first()
        if not slot:
            raise HTTPException(status_code=404, detail="INTERVIEW_SLOT_NOT_FOUND")
        if slot["status"] == "booked":
            raise HTTPException(status_code=409, detail="SLOT_ALREADY_BOOKED: Slot wawancara ini sudah dipesan.")

    # 3. Lock candidate (no JOIN here: locking job_descriptions would widen the
    #    transaction's lock set beyond the PRD's users -> interview_slots ->
    #    candidates hierarchy and risk deadlock with concurrent job updates)
    cand_res = await db.execute(
        text("""
            SELECT id, job_id, masked_identifier, status, is_deleted, version,
                   encrypted_email, encrypted_dek
            FROM candidates
            WHERE id = :cid FOR UPDATE
        """),
        {"cid": candidate_id},
    )
    cand = cand_res.mappings().first()
    if not cand or cand["is_deleted"]:
        raise HTTPException(status_code=404, detail="CANDIDATE_NOT_FOUND_OR_DELETED")

    if cand["status"] in ("approved", "rejected"):
        raise HTTPException(
            status_code=409,
            detail=f"CANDIDATE_DECISION_ALREADY_FINAL: Kandidat sudah berstatus final ('{cand['status']}'). Penjadwalan atau penolakan hanya dapat dilakukan sekali.",
        )

    # 4. Support direct date & time input without selecting pre-existing slot
    if decision == "APPROVED_DISPATCH":
        if slot_id is None and interview_date and interview_time:
            try:
                start_dt = datetime.fromisoformat(f"{interview_date.strip()}T{interview_time.strip()}:00")
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail="INVALID_DATETIME: Format tanggal (YYYY-MM-DD) atau jam (HH:MM) tidak valid.",
                )
            end_dt = start_dt + timedelta(minutes=int(duration_minutes or 60))

            # Check overlap for reviewer
            overlap_res = await db.execute(
                text("""
                    SELECT id FROM interview_slots
                    WHERE interviewer_id = :uid
                      AND status IN ('tentative', 'booked')
                      AND start_time < :end_time
                      AND end_time > :start_time
                    FOR UPDATE
                """),
                {"uid": reviewer_id, "start_time": start_dt, "end_time": end_dt},
            )
            if overlap_res.first():
                raise HTTPException(
                    status_code=409,
                    detail="INTERVIEWER_SCHEDULE_CONFLICT: Terdapat jadwal wawancara lain yang bertabrakan pada rentang waktu ini.",
                )

            slot_insert = await db.execute(
                text("""
                    INSERT INTO interview_slots (
                        candidate_id, interviewer_id, start_time, end_time, status,
                        lock_version, tentative_expires_at
                    ) VALUES (
                        :cid, :uid, :start_time, :end_time, 'booked', 1, NULL
                    )
                """),
                {
                    "cid": candidate_id,
                    "uid": reviewer_id,
                    "start_time": start_dt,
                    "end_time": end_dt,
                },
            )
            slot_id = getattr(slot_insert, "lastrowid", None)
            if not slot_id:
                fetch_id = await db.execute(
                    text("SELECT id FROM interview_slots WHERE candidate_id = :cid ORDER BY id DESC LIMIT 1"),
                    {"cid": candidate_id},
                )
                slot_id = fetch_id.scalar()

            if not slot_id:
                raise HTTPException(status_code=500, detail="FAILED_TO_CREATE_INTERVIEW_SLOT")

            slot_id = int(slot_id)
            event_id = mock_calendar_adapter.generate_event_id(slot_id, candidate_id)
            await db.execute(
                text("UPDATE interview_slots SET external_calendar_event_id = :eid WHERE id = :sid"),
                {"eid": event_id, "sid": slot_id},
            )

    job_title = "Posisi Rekrutmen"
    try:
        job_row = await db.execute(
            text("SELECT title FROM job_descriptions WHERE id = :jid"),
            {"jid": cand["job_id"]},
        )
        fetched = job_row.mappings().first()
        if fetched and fetched["title"]:
            job_title = fetched["title"]
    except Exception:
        pass

    # Determine next status
    status_map = {
        "APPROVED_DISPATCH": "approved",
        "REQUEST_INFO": "request_info",
        "OVERRIDE_REJECT": "rejected",
        "REJECT_CONFIRMED": "rejected",
    }
    next_status = status_map[decision]

    # If slot confirmed, transition slot to 'booked'
    if slot_id is not None and decision == "APPROVED_DISPATCH":
        await db.execute(
            text("""
                UPDATE interview_slots
                SET status = 'booked',
                    candidate_id = :cid,
                    tentative_expires_at = NULL
                WHERE id = :sid
            """),
            {"sid": slot_id, "cid": candidate_id},
        )

    # Update candidate status
    await db.execute(
        text("""
            UPDATE candidates
            SET status = :st,
                version = version + 1
            WHERE id = :cid
        """),
        {"st": next_status, "cid": candidate_id},
    )

    # Insert human review record
    await db.execute(
        text("""
            INSERT INTO human_reviews (
                candidate_id, reviewer_id, decision, notes, version
            ) VALUES (
                :cid, :rid, :dec, :notes, :ver
            )
        """),
        {
            "cid": candidate_id,
            "rid": reviewer_id,
            "dec": decision,
            "notes": notes,
            "ver": (cand["version"] or 1),
        },
    )

    await db.commit()

    # --- Post-commit side effects -----------------------------------------
    # Deliberately after commit: a notification failure must never roll back the
    # human decision. Each effect is best-effort and reported, not raised.
    notifications = {}

    # 1. Google Calendar event (only on an approved dispatch with a booked slot)
    if slot_id is not None and decision == "APPROVED_DISPATCH":
        notifications["calendar"] = await _sync_calendar_booking(
            db=db,
            reviewer_id=reviewer_id,
            slot_id=slot_id,
            candidate_id=candidate_id,
            candidate=cand,
            job_title=job_title,
        )

    # 2. Applicant email — only for a final decision, never during blind review
    notifications["email"] = await _notify_candidate_decision(
        candidate=cand,
        job_title=job_title,
        decision=decision,
        slot_id=slot_id,
        notes=notes,
    )

    return {
        "status": "success",
        "candidate_id": candidate_id,
        "masked_identifier": cand["masked_identifier"],
        "decision": decision,
        "new_candidate_status": next_status,
        "booked_slot_id": slot_id if decision == "APPROVED_DISPATCH" else None,
        "notifications": notifications,
    }


@router.delete("/{candidate_id}")
async def right_to_erasure_candidate(
    candidate_id: int,
    request: Request,
    reason: str = Form("RIGHT_TO_ERASURE_FULFILLED"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "compliance_officer", "recruiter")),
):
    """
    Executes UU PDP No. 27/2022 compliant Crypto-Shredding soft-erasure
    via unified talentops_erasure service.
    """
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "127.0.0.1")
    acting_user_id = int(current_user["id"]) if isinstance(current_user, dict) and current_user.get("id") else 1
    result = await execute_talentops_erasure(
        db=db,
        candidate_id=candidate_id,
        reason=reason,
        ip_address=client_ip,
        user_id=acting_user_id,
    )
    if not result.get("success"):
        raise HTTPException(status_code=404, detail="CANDIDATE_NOT_FOUND_OR_ALREADY_DELETED")

    await db.commit()

    # Only after the row is committed: deleting earlier would strand the file if
    # the commit failed, leaving a live row pointing at a missing document.
    stored_resume_name = result.pop("stored_resume_name", None)
    if stored_resume_name:
        delete_resume_file(stored_resume_name)

    return result


@router.post("/{candidate_id}/sse-ticket")
async def issue_sse_stream_ticket(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager", "compliance_officer")),
):
    """
    Issues single-use UUID ticket (TTL 60s) for authenticated SSE streaming
    as specified in PRD Bab 8.2 Endpoint 15.
    """
    cand_res = await db.execute(
        text("SELECT id, is_deleted FROM candidates WHERE id = :id"),
        {"id": candidate_id},
    )
    cand = cand_res.mappings().first()
    if not cand or cand["is_deleted"]:
        raise HTTPException(status_code=404, detail="CANDIDATE_NOT_FOUND_OR_DELETED")

    ticket = await sse_broadcaster.issue_ticket(candidate_id=candidate_id)
    return {
        "status": "success",
        "candidate_id": candidate_id,
        "ticket": ticket,
        "expires_in_seconds": 60,
    }


@router.get("/{candidate_id}/trace-stream")
async def trace_stream_agent_execution(
    candidate_id: int,
    ticket: Optional[str] = Query(None),
):
    """
    PRD Bab 8.2 Endpoint 8:
    Authenticated SSE endpoint for agent execution stream.
    Requires single-use UUID ticket (burn-on-read).
    """
    if not ticket:
        raise HTTPException(status_code=401, detail="MISSING_SSE_STREAM_TICKET")

    is_valid = await sse_broadcaster.validate_and_burn_ticket(candidate_id=candidate_id, ticket=ticket)
    if not is_valid:
        raise HTTPException(status_code=403, detail="INVALID_OR_EXPIRED_SSE_TICKET")

    async def event_generator():
        async for event in sse_broadcaster.subscribe(candidate_id):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/stream/{candidate_id}", include_in_schema=False)
async def stream_agent_triage_trace(
    candidate_id: int,
    ticket: Optional[str] = Query(None),
):
    """
    DEPRECATED unauthenticated alias. Kept only to reject old clients explicitly
    instead of silently streaming candidate triage reasoning without a ticket.
    Use POST /{candidate_id}/sse-ticket -> GET /{candidate_id}/trace-stream.
    """
    if not ticket:
        raise HTTPException(status_code=401, detail="MISSING_SSE_STREAM_TICKET")
    is_valid = await sse_broadcaster.validate_and_burn_ticket(candidate_id=candidate_id, ticket=ticket)
    if not is_valid:
        raise HTTPException(status_code=403, detail="INVALID_OR_EXPIRED_SSE_TICKET")

    async def event_generator():
        async for event in sse_broadcaster.subscribe(candidate_id):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginx SSE unbuffered
        },
    )


async def _run_triage_background(candidate_id: int):
    """Executes agent triage asynchronously in background task with dedicated DB session."""
    async with AsyncSessionLocal() as session:
        try:
            await agent_triage_service.execute_triage(
                candidate_id=candidate_id,
                db=session,
                use_cache=True,
            )
        except Exception as exc:
            logger.error(f"Background triage failed for candidate {candidate_id}: {exc}")
            try:
                await session.execute(
                    text("UPDATE candidates SET status = 'failed' WHERE id = :id"),
                    {"id": candidate_id},
                )
                await session.commit()
            except Exception as db_err:
                logger.error(f"Failed to update candidate {candidate_id} status to failed: {db_err}")
            try:
                await sse_broadcaster.publish(
                    candidate_id, "triage_completed", "failed",
                    {
                        "error": str(exc),
                        "recommendation": "REVIEW_REQUIRED",
                        "overall_score": 50.0,
                    },
                    is_terminal=True,
                )
            except Exception:
                pass


@router.post("/{candidate_id}/triage")
async def trigger_single_candidate_triage(
    candidate_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager")),
):
    """
    On-demand agentic triage trigger for a single candidate (PRD Bab 8.2).
    Dispatches asynchronous autonomous evaluation via FastAPI BackgroundTasks.
    """
    cand_res = await db.execute(
        text("SELECT id, masked_identifier, status, is_deleted FROM candidates WHERE id = :id"),
        {"id": candidate_id},
    )
    cand = cand_res.mappings().first()
    if not cand or cand["is_deleted"]:
        raise HTTPException(status_code=404, detail="CANDIDATE_NOT_FOUND")

    background_tasks.add_task(_run_triage_background, candidate_id)

    return {
        "status": "processing",
        "message": "Autonomous agent triage dispatched in background.",
        "candidate_id": candidate_id,
        "masked_identifier": cand["masked_identifier"],
        "stream_url": f"/api/candidates/{candidate_id}/trace-stream",
        "sse_ticket_endpoint": f"/api/candidates/{candidate_id}/sse-ticket",
    }


class BatchTriageRequest(BaseModel):
    job_id: Optional[int] = None
    candidate_ids: Optional[List[int]] = None


@router.post("/batch-triage")
async def trigger_batch_candidates_triage(
    background_tasks: BackgroundTasks,
    payload: Optional[BatchTriageRequest] = None,
    job_id: Optional[int] = None,
    candidate_ids: Optional[List[int]] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager")),
):
    """
    On-demand batch triage trigger for multiple candidates (PRD Bab 8.2).
    Dispatches autonomous triage pipeline with Semaphore concurrency control.
    Supports both JSON request body and URL query parameters.
    """
    target_job_id = payload.job_id if payload and payload.job_id is not None else job_id
    target_cids = payload.candidate_ids if payload and payload.candidate_ids is not None else candidate_ids

    if target_cids is not None:
        if not target_cids:
            return {
                "status": "success",
                "message": "No candidates specified for batch triage.",
                "dispatched_count": 0,
                "candidate_ids": [],
            }
        stmt = text("SELECT id FROM candidates WHERE id IN :cids AND is_deleted = FALSE").bindparams(
            bindparam("cids", expanding=True)
        )
        res = await db.execute(stmt, {"cids": list(target_cids)})
    elif target_job_id:
        stmt = text("SELECT id FROM candidates WHERE job_id = :jid AND status = 'queued' AND is_deleted = FALSE")
        res = await db.execute(stmt, {"jid": target_job_id})
    else:
        stmt = text("SELECT id FROM candidates WHERE status = 'queued' AND is_deleted = FALSE LIMIT 20")
        res = await db.execute(stmt)

    targets = [r[0] for r in res.fetchall()]

    for cid in targets:
        background_tasks.add_task(_run_triage_background, cid)

    return {
        "status": "processing",
        "message": f"Batch triage dispatched for {len(targets)} candidates.",
        "dispatched_count": len(targets),
        "candidate_ids": targets,
    }


@router.get("/{candidate_id}/evidence-graph")
async def get_candidate_evidence_graph(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager", "compliance_officer")),
):
    """
    PRD Bab 8.2 (Item 10) & Bab 1.2:
    Retrieves interactive Evidence Graph schema (React Flow nodes and edges)
    connecting candidate claims directly to verified CV substrings and GitHub metadata.
    """
    cand_res = await db.execute(
        text("SELECT id, job_id, masked_identifier, overall_score, confidence_level, unresolved_risk, recommendation, github_url, portfolio_url, is_deleted FROM candidates WHERE id = :id AND is_deleted = FALSE"),
        {"id": candidate_id},
    )
    cand = cand_res.mappings().first()
    if not cand:
        raise HTTPException(status_code=404, detail="CANDIDATE_NOT_FOUND")

    # Fetch evidence
    ev_res = await db.execute(
        text("SELECT id, dimension, target_competency, matched_requirement, claim_text, evidence_source, score_contribution, confidence, verified FROM candidate_evidence WHERE candidate_id = :id ORDER BY dimension, id"),
        {"id": candidate_id},
    )
    evidence_rows = [dict(r) for r in ev_res.mappings()]

    # Fetch anomalies
    anom_res = await db.execute(
        text("SELECT id, anomaly_type, severity, description, suggested_verification FROM candidate_anomalies WHERE candidate_id = :id"),
        {"id": candidate_id},
    )
    anomalies = [dict(a) for a in anom_res.mappings()]

    # Construct React Flow nodes and edges
    nodes = []
    edges = []

    # 1. Root Node (Candidate)
    root_id = f"cand-{cand['id']}"
    nodes.append({
        "id": root_id,
        "type": "candidateRoot",
        "data": {
            "label": cand["masked_identifier"],
            "overall_score": float(cand["overall_score"]) if cand["overall_score"] is not None else 0.0,
            "recommendation": cand["recommendation"],
            "confidence_level": cand["confidence_level"],
            "unresolved_risk": cand["unresolved_risk"],
            "github_url": cand["github_url"],
        },
        "position": {"x": 540, "y": 40},
    })

    # 2. Dimension Nodes
    dimensions = ["SKILL", "EXPERIENCE", "EDUCATION", "PORTFOLIO"]
    dim_x = [60, 380, 700, 1020]
    for idx, dim in enumerate(dimensions):
        dim_node_id = f"dim-{dim.lower()}"
        dim_claims = [e for e in evidence_rows if e["dimension"] == dim]
        nodes.append({
            "id": dim_node_id,
            "type": "dimensionNode",
            "data": {
                "label": dim,
                "claims_count": len(dim_claims),
                "is_empty": len(dim_claims) == 0,
            },
            "position": {"x": dim_x[idx], "y": 200},
        })
        edges.append({
            "id": f"edge-root-{dim_node_id}",
            "source": root_id,
            "target": dim_node_id,
            "animated": True,
        })

        # 3. Evidence Claim Nodes
        for c_idx, claim in enumerate(dim_claims):
            claim_id = f"ev-{claim['id']}"
            nodes.append({
                "id": claim_id,
                "type": "evidenceClaimNode",
                "data": {
                    "competency": claim["target_competency"],
                    "claim_text": claim["claim_text"],
                    "source": claim["evidence_source"],
                    "score": float(claim["score_contribution"]),
                    "confidence": float(claim["confidence"]),
                },
                "position": {"x": dim_x[idx], "y": 330 + (c_idx * 160)},
            })
            edges.append({
                "id": f"edge-{dim_node_id}-{claim_id}",
                "source": dim_node_id,
                "target": claim_id,
            })

    # 4. Anomaly Nodes (if any)
    if anomalies:
        anom_root_id = "anomalies-group"
        nodes.append({
            "id": anom_root_id,
            "type": "riskNode",
            "data": {"label": "DETECTED ANOMALIES", "count": len(anomalies)},
            "position": {"x": 1340, "y": 200},
        })
        edges.append({
            "id": f"edge-root-{anom_root_id}",
            "source": root_id,
            "target": anom_root_id,
            "style": {"stroke": "#ef4444"},
        })
        for a_idx, anom in enumerate(anomalies):
            anom_id = f"anom-{anom['id']}"
            nodes.append({
                "id": anom_id,
                "type": "anomalyDetailNode",
                "data": {
                    "type": anom["anomaly_type"],
                    "severity": anom["severity"],
                    "description": anom["description"],
                },
                "position": {"x": 1340, "y": 330 + (a_idx * 160)},
            })
            edges.append({
                "id": f"edge-{anom_root_id}-{anom_id}",
                "source": anom_root_id,
                "target": anom_id,
                "style": {"stroke": "#ef4444"},
            })

    return {
        "candidate_id": cand["id"],
        "masked_identifier": cand["masked_identifier"],
        "graph": {
            "nodes": nodes,
            "edges": edges,
        },
        "summary": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "evidence_count": len(evidence_rows),
            "anomaly_count": len(anomalies),
        },
    }


@router.post("/{candidate_id}/unmask")
async def unmask_candidate_pii(
    candidate_id: int,
    request: Request,
    reason: str = Form(...),
    reviewer_role: str = Form("recruiter"),
    reviewer_id: int = Form(1),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager", "compliance_officer")),
):
    """
    PRD Bab 8.1 & Bab 6.2 Item 4:
    Governance-guarded unmasking of candidate direct PII.
    Only permitted after final approval (status 'approved') OR by compliance officer/admin.
    Mandatory reason is audit-logged into pii_access_logs.
    """
    # Authenticated identity/role overrides client-supplied form values outside DEMO_MODE
    if isinstance(current_user, dict) and current_user.get("id"):
        reviewer_id = int(current_user["id"])
        if not settings.DEMO_MODE:
            reviewer_role = current_user.get("role", reviewer_role)

    cand_res = await db.execute(
        text("SELECT id, masked_identifier, status, encrypted_name, encrypted_email, encrypted_phone, encrypted_dek, is_deleted FROM candidates WHERE id = :id"),
        {"id": candidate_id},
    )
    cand = cand_res.mappings().first()
    if not cand or cand["is_deleted"]:
        raise HTTPException(status_code=404, detail="CANDIDATE_NOT_FOUND_OR_DELETED")

    allowed_roles = {"compliance_officer", "admin"}
    if cand["status"] != "approved" and reviewer_role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="UNMASK_FORBIDDEN_DURING_BLIND_REVIEW: Candidate PII is protected under blind evaluation rules until decision is APPROVED_DISPATCH, unless authorized by Compliance Officer or Admin."
        )

    # Decrypt DEK then decrypt PII
    try:
        dek = decrypt_dek(cand["encrypted_dek"])
        name = decrypt_pii(cand["encrypted_name"], dek) if cand["encrypted_name"] else ""
        email = decrypt_pii(cand["encrypted_email"], dek) if cand["encrypted_email"] else ""
        phone = decrypt_pii(cand["encrypted_phone"], dek) if cand["encrypted_phone"] else None
    except Exception as exc:
        logger.error(f"Failed to decrypt candidate PII: {exc}")
        raise HTTPException(status_code=500, detail="DECRYPTION_FAILED_INTEGRITY_COMPROMISED")

    # Record access log
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "127.0.0.1")
    await db.execute(
        text("""
            INSERT INTO pii_access_logs (
                user_id, candidate_id, masked_identifier, reason, ip_address
            ) VALUES (
                :uid, :cid, :mid, :reason, :ip
            )
        """),
        {
            "uid": reviewer_id,
            "cid": candidate_id,
            "mid": cand["masked_identifier"],
            "reason": f"[{reviewer_role.upper()}] {reason}",
            "ip": client_ip,
        },
    )
    await db.commit()

    return {
        "status": "success",
        "candidate_id": cand["id"],
        "masked_identifier": cand["masked_identifier"],
        "unmasked_data": {
            "name": name,
            "email": email,
            "phone": phone,
        },
        "governance": {
            "authorized_by_role": reviewer_role,
            "reason": reason,
            "logged_to_audit_trail": True,
        },
    }


RESUME_MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain; charset=utf-8",
}


def _resume_media_type(suffix: str) -> str:
    """Explicit map: guessing served .txt as DOCX, which browsers then refuse."""
    return RESUME_MEDIA_TYPES.get((suffix or "").lower(), "application/octet-stream")


@router.get("/{candidate_id}/resume-file")
async def download_candidate_resume(
    candidate_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager", "compliance_officer")),
):
    """Serves the applicant's original PDF/DOCX.

    The file is the raw document, so every fetch is written to pii_access_logs —
    same governance trail as unmasking, minus the blind-review block (the file is
    already sanitized in `sanitized_resume_text`, and this is the artefact the
    reviewer is evaluating).
    """
    cand_res = await db.execute(
        text("SELECT id, masked_identifier, resume_file_path, is_deleted FROM candidates WHERE id = :id"),
        {"id": candidate_id},
    )
    cand = cand_res.mappings().first()
    if not cand or cand["is_deleted"]:
        raise HTTPException(status_code=404, detail="CANDIDATE_NOT_FOUND_OR_DELETED")

    path = resolve_resume_file(cand["resume_file_path"])
    if not path:
        raise HTTPException(status_code=404, detail="RESUME_FILE_NOT_STORED")

    reviewer_id = int(current_user.get("id") or 1) if isinstance(current_user, dict) else 1
    reviewer_role = current_user.get("role", "recruiter") if isinstance(current_user, dict) else "recruiter"
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "127.0.0.1")

    await db.execute(
        text("""
            INSERT INTO pii_access_logs (
                user_id, candidate_id, masked_identifier, reason, ip_address
            ) VALUES (:uid, :cid, :mid, :reason, :ip)
        """),
        {
            "uid": reviewer_id,
            "cid": candidate_id,
            "mid": cand["masked_identifier"],
            "reason": f"[{reviewer_role.upper()}] RESUME_FILE_DOWNLOAD",
            "ip": client_ip,
        },
    )
    await db.commit()

    return FileResponse(
        path,
        media_type=_resume_media_type(path.suffix),
        filename=f"{cand['masked_identifier'].lstrip('#')}{path.suffix}",
    )

