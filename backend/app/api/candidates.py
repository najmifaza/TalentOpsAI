import hashlib
import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db, AsyncSessionLocal
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
from app.core.sanitizer import sanitize_pii
from app.core.hidden_text_detector import audit_docx_hidden_text
from app.core.file_parser import (
    validate_file_magic_bytes,
    extract_text_from_file,
    generate_masked_identifier,
    generate_tracking_token,
)
from app.core.erasure import execute_talentops_erasure
from app.core.broadcaster import sse_broadcaster
from app.adapters.calendar import mock_calendar_adapter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/candidates", tags=["HR Recruiter Candidate Management"])


@router.get("")
async def list_candidates(
    job_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    Lists candidates for HR Recruiter Dashboard.
    Omits plaintext PII; displays masked_identifier and evaluation stats.
    """
    query_str = """
        SELECT id, job_id, masked_identifier, tracking_token, overall_score, confidence_level,
               unresolved_risk, recommendation, triage_priority, status,
               dimension_scores, is_deleted, created_at
        FROM candidates
        WHERE is_deleted = FALSE
    """
    params = {}
    if job_id:
        query_str += " AND job_id = :job_id"
        params["job_id"] = job_id
    if status:
        query_str += " AND status = :status"
        params["status"] = status

    query_str += " ORDER BY triage_priority DESC, created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    res = await db.execute(text(query_str), params)
    rows = []
    for r in res.mappings():
        dim = r["dimension_scores"]
        if isinstance(dim, str):
            try:
                dim = json.loads(dim)
            except Exception:
                dim = {}
        rows.append({
            "id": r["id"],
            "job_id": r["job_id"],
            "masked_identifier": r["masked_identifier"],
            "tracking_token": r.get("tracking_token"),
            "overall_score": float(r["overall_score"]) if r["overall_score"] is not None else None,
            "confidence_level": r["confidence_level"],
            "unresolved_risk": r["unresolved_risk"],
            "recommendation": r["recommendation"],
            "triage_priority": r["triage_priority"],
            "status": r["status"],
            "dimension_scores": dim,
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        })
    return {"data": rows, "count": len(rows)}


@router.get("/{candidate_id}")
async def get_candidate_dossier(candidate_id: int, db: AsyncSession = Depends(get_db)):
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
        text("SELECT id, dimension, target_competency, claim_text, evidence_source, score_contribution, confidence FROM candidate_evidence WHERE candidate_id = :id"),
        {"id": candidate_id},
    )
    evidence = [dict(e) for e in ev_res.mappings()]

    # Fetch assessments
    ass_res = await db.execute(
        text("SELECT id, target_skill, difficulty_level, scenario_question, evaluation_criteria FROM candidate_assessments WHERE candidate_id = :id"),
        {"id": candidate_id},
    )
    assessments = [dict(ass) for ass in ass_res.mappings()]

    return {
        "candidate": {
            "id": cand["id"],
            "job_id": cand["job_id"],
            "masked_identifier": cand["masked_identifier"],
            "status": cand["status"],
            "triage_priority": cand["triage_priority"],
            "overall_score": float(cand["overall_score"]) if cand["overall_score"] is not None else None,
            "confidence_level": cand["confidence_level"],
            "unresolved_risk": cand["unresolved_risk"],
            "recommendation": cand["recommendation"],
            "github_url": cand["github_url"],
            "portfolio_url": cand["portfolio_url"],
            "sanitized_resume_text": cand["sanitized_resume_text"],
            "created_at": cand["created_at"].isoformat() if cand["created_at"] else None,
        },
        "anomalies": anomalies,
        "evidence": evidence,
        "assessments": assessments,
    }


@router.post("/upload")
async def hr_direct_upload(
    job_id: int = Form(...),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    HR direct multi-file dropzone for candidate resumes.
    Parses files in-memory, applies rule-based heuristic sanitization,
    encrypts data, and inserts into candidates table with initial status 'queued'.
    """
    job_check = await db.execute(
        text("SELECT id FROM job_descriptions WHERE id = :id AND status = 'active'"),
        {"id": job_id},
    )
    if not job_check.first():
        raise HTTPException(status_code=404, detail="JOB_NOT_FOUND_OR_CLOSED")

    uploaded = []
    for file in files:
        file_bytes = await file.read()
        file_format = validate_file_magic_bytes(file_bytes, file.filename or "")
        file_hash = hashlib.sha256(file_bytes).hexdigest()

        raw_text = extract_text_from_file(file_bytes, file_format)

        hidden_text_detected = False
        hidden_snippets: list[str] = []
        if file_format == "docx":
            cleaned_body, hidden_snippets = audit_docx_hidden_text(file_bytes)
            if hidden_snippets:
                hidden_text_detected = True
                raw_text = cleaned_body

        sanitized_text, sanitize_stats = sanitize_pii(raw_text)

        candidate_dek = generate_dek()
        enc_dek = encrypt_dek(candidate_dek)
        # Placeholder encrypted names for HR bulk upload
        enc_name = encrypt_pii(f"Applicant-{file.filename}", candidate_dek)
        enc_email = encrypt_pii("hr_dropzone_upload@talentops.internal", candidate_dek)
        email_blind_idx = compute_blind_index(f"{file_hash}@talentops.internal")

        masked_id = generate_masked_identifier()
        tracking_token = generate_tracking_token()

        res = await db.execute(
            text("""
                INSERT INTO candidates (
                    job_id, encrypted_name, encrypted_email, encrypted_phone, encrypted_dek,
                    email_blind_index, masked_identifier, tracking_token, resume_file_path,
                    file_hash_sha256, sanitized_resume_text, status, is_deleted, version
                ) VALUES (
                    :job_id, :enc_name, :enc_email, NULL, :enc_dek,
                    :email_blind_idx, :masked_id, :tracking_token, :file_name,
                    :file_hash, :sanitized_text, 'queued', FALSE, 1
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
                "file_name": file.filename,
                "file_hash": file_hash,
                "sanitized_text": sanitized_text,
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

        uploaded.append({
            "candidate_id": cand_id,
            "filename": file.filename,
            "masked_identifier": masked_id,
            "status": "queued",
            "sanitization_stats": sanitize_stats,
        })

    await db.commit()
    return {"status": "success", "uploaded_count": len(uploaded), "candidates": uploaded}


@router.post("/{candidate_id}/review")
async def review_candidate(
    candidate_id: int,
    decision: str = Form(...),  # APPROVED_DISPATCH, REQUEST_INFO, OVERRIDE_REJECT, REJECT_CONFIRMED
    notes: Optional[str] = Form(None),
    slot_id: Optional[int] = Form(None),
    reviewer_id: int = Form(1),
    db: AsyncSession = Depends(get_db),
):
    """
    HITL Candidate Review Decision Gatekeeper:
    - Enforces strict transactional lock hierarchy: `users` -> `interview_slots` -> `candidates`.
    - Handles interview slot confirmation if APPROVED_DISPATCH with slot_id.
    - Updates candidate status & records append-only decision to human_reviews.
    """
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
        if slot["status"] == "booked" and slot["candidate_id"] != candidate_id:
            raise HTTPException(status_code=409, detail="SLOT_ALREADY_BOOKED_BY_ANOTHER_CANDIDATE")

    # 3. Lock candidate
    cand_res = await db.execute(
        text("SELECT id, masked_identifier, status, is_deleted, version FROM candidates WHERE id = :cid FOR UPDATE"),
        {"cid": candidate_id},
    )
    cand = cand_res.mappings().first()
    if not cand or cand["is_deleted"]:
        raise HTTPException(status_code=404, detail="CANDIDATE_NOT_FOUND_OR_DELETED")

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
    return {
        "status": "success",
        "candidate_id": candidate_id,
        "masked_identifier": cand["masked_identifier"],
        "decision": decision,
        "new_candidate_status": next_status,
        "booked_slot_id": slot_id if decision == "APPROVED_DISPATCH" else None,
    }


@router.delete("/{candidate_id}")
async def right_to_erasure_candidate(
    candidate_id: int,
    request: Request,
    reason: str = Form("RIGHT_TO_ERASURE_FULFILLED"),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes UU PDP No. 27/2022 compliant Crypto-Shredding soft-erasure
    via unified talentops_erasure service.
    """
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "127.0.0.1")
    result = await execute_talentops_erasure(
        db=db,
        candidate_id=candidate_id,
        reason=reason,
        ip_address=client_ip,
        user_id=1,
    )
    if not result.get("success"):
        raise HTTPException(status_code=404, detail="CANDIDATE_NOT_FOUND_OR_ALREADY_DELETED")

    await db.commit()
    return result


@router.post("/{candidate_id}/sse-ticket")
async def issue_sse_stream_ticket(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
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


@router.get("/stream/{candidate_id}")
async def stream_agent_triage_trace(candidate_id: int):
    """
    SSE stream endpoint for candidate triage execution.
    Delivers real-time execution trace to Willy's Frontend listener.
    """
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


@router.post("/{candidate_id}/triage")
async def trigger_single_candidate_triage(
    candidate_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
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
        "stream_url": f"/api/candidates/stream/{candidate_id}",
    }


@router.post("/batch-triage")
async def trigger_batch_candidates_triage(
    background_tasks: BackgroundTasks,
    job_id: Optional[int] = None,
    candidate_ids: Optional[List[int]] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    On-demand batch triage trigger for multiple candidates (PRD Bab 8.2).
    Dispatches autonomous triage pipeline with Semaphore concurrency control.
    """
    if candidate_ids:
        query = "SELECT id FROM candidates WHERE id IN :cids AND is_deleted = FALSE"
        params = {"cids": tuple(candidate_ids)}
    elif job_id:
        query = "SELECT id FROM candidates WHERE job_id = :jid AND status = 'queued' AND is_deleted = FALSE"
        params = {"jid": job_id}
    else:
        query = "SELECT id FROM candidates WHERE status = 'queued' AND is_deleted = FALSE LIMIT 20"
        params = {}

    res = await db.execute(text(query), params)
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
        text("SELECT id, dimension, target_competency, claim_text, evidence_source, score_contribution, confidence FROM candidate_evidence WHERE candidate_id = :id ORDER BY dimension, id"),
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
        },
        "position": {"x": 400, "y": 50},
    })

    # 2. Dimension Nodes
    dimensions = ["SKILL", "EXPERIENCE", "EDUCATION", "PORTFOLIO"]
    dim_x = [100, 300, 500, 700]
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
                "position": {"x": dim_x[idx], "y": 320 + (c_idx * 110)},
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
            "position": {"x": 900, "y": 200},
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
                "position": {"x": 900, "y": 320 + (a_idx * 110)},
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
):
    """
    PRD Bab 8.1 & Bab 6.2 Item 4:
    Governance-guarded unmasking of candidate direct PII.
    Only permitted after final approval (status 'approved') OR by compliance officer/admin.
    Mandatory reason is audit-logged into pii_access_logs.
    """
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

