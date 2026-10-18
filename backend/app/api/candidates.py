import hashlib
import json
import logging
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db, AsyncSessionLocal
from app.core.triage_service import agent_triage_service
from app.core.crypto import (
    generate_dek,
    encrypt_dek,
    encrypt_pii,
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
from app.core.broadcaster import sse_broadcaster

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
        SELECT id, job_id, masked_identifier, overall_score, confidence_level,
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


@router.delete("/{candidate_id}")
async def right_to_erasure_candidate(
    candidate_id: int,
    request: Request,
    reason: str = Form("RIGHT_TO_ERASURE_FULFILLED"),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes UU PDP No. 27/2022 compliant Crypto-Shredding soft-erasure:
    1. Overwrites DEK with destroyed zero-bytes.
    2. Overwrites email_blind_index with random cryptographic tombstone hash.
    3. Nulls out sanitized_resume_text, file_hash_sha256, resume_file_path.
    4. Sets is_deleted = TRUE (non-physical deletion to preserve relational integrity).
    5. Records append-only audit trail in pii_access_logs.
    """
    cand_res = await db.execute(
        text("SELECT id, masked_identifier, is_deleted FROM candidates WHERE id = :id"),
        {"id": candidate_id},
    )
    cand = cand_res.mappings().first()
    if not cand or cand["is_deleted"]:
        raise HTTPException(status_code=404, detail="CANDIDATE_NOT_FOUND_OR_ALREADY_DELETED")

    masked_id = cand["masked_identifier"]
    tombstone = generate_tombstone_hash()
    dead_dek = b"\x00" * 32

    # 1. Soft-delete and shred candidate table
    await db.execute(
        text("""
            UPDATE candidates
            SET encrypted_name = :dead_dek,
                encrypted_email = :dead_dek,
                encrypted_phone = NULL,
                encrypted_dek = :dead_dek,
                email_blind_index = :tombstone,
                file_hash_sha256 = NULL,
                sanitized_resume_text = NULL,
                resume_file_path = NULL,
                github_url = NULL,
                portfolio_url = NULL,
                is_deleted = TRUE
            WHERE id = :id
        """),
        {"id": candidate_id, "dead_dek": dead_dek, "tombstone": tombstone},
    )

    # 2. Clean candidate evidence & assessments
    await db.execute(text("DELETE FROM candidate_evidence WHERE candidate_id = :id"), {"id": candidate_id})
    await db.execute(text("DELETE FROM candidate_assessments WHERE candidate_id = :id"), {"id": candidate_id})

    # 3. Append to pii_access_logs
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "127.0.0.1")
    await db.execute(
        text("""
            INSERT INTO pii_access_logs (
                user_id, candidate_id, masked_identifier, reason, ip_address
            ) VALUES (
                1, :cand_id, :masked_id, :reason, :ip
            )
        """),
        {
            "cand_id": candidate_id,
            "masked_id": masked_id,
            "reason": reason,
            "ip": client_ip,
        },
    )

    await db.commit()
    return {
        "status": "success",
        "message": "Candidate crypto-shredded successfully under UU PDP No. 27/2022.",
        "masked_identifier": masked_id,
        "is_deleted": True,
    }


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

