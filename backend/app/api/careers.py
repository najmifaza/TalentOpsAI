import hashlib
import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.crypto import (
    generate_dek,
    encrypt_dek,
    encrypt_pii,
    compute_blind_index,
)
from app.core.sanitizer import sanitize_pii
from app.core.hidden_text_detector import audit_docx_hidden_text, audit_document_hidden_text
from app.core.file_parser import (
    validate_file_magic_bytes,
    extract_text_from_file,
    generate_masked_identifier,
    generate_tracking_token,
)
from app.core.rate_limiter import apply_rate_limiter
from app.core.erasure import execute_talentops_erasure
from app.core.email import email_service
from app.core.email_templates import application_received, erasure_confirmation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/careers", tags=["Public Career Portal"])


@router.get("")
async def list_active_jobs(db: AsyncSession = Depends(get_db)):
    """Public list of active job descriptions."""
    res = await db.execute(
        text("SELECT id, title, department, raw_text, core_competencies, status, created_at FROM job_descriptions WHERE status = 'active'")
    )
    jobs = []
    for row in res.mappings():
        comp = row["core_competencies"]
        if isinstance(comp, str):
            try:
                comp = json.loads(comp)
            except Exception:
                comp = []
        jobs.append({
            "id": row["id"],
            "title": row["title"],
            "department": row["department"],
            "raw_text": row["raw_text"],
            "core_competencies": comp,
            "status": row["status"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        })
    return {"data": jobs, "total": len(jobs)}


@router.get("/{job_id}")
async def get_job_detail(job_id: int, db: AsyncSession = Depends(get_db)):
    """Public detail of single active job description."""
    res = await db.execute(
        text("SELECT id, title, department, raw_text, core_competencies, status FROM job_descriptions WHERE id = :id AND status = 'active'"),
        {"id": job_id},
    )
    job = res.mappings().first()
    if not job:
        raise HTTPException(status_code=404, detail="JOB_NOT_FOUND_OR_CLOSED")

    comp = job["core_competencies"]
    if isinstance(comp, str):
        try:
            comp = json.loads(comp)
        except Exception:
            comp = []

    return {
        "id": job["id"],
        "title": job["title"],
        "department": job["department"],
        "raw_text": job["raw_text"],
        "core_competencies": comp,
        "status": job["status"],
    }


@router.post("/{job_id}/apply")
async def submit_application(
    job_id: int,
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    github_url: Optional[str] = Form(None),
    portfolio_url: Optional[str] = Form(None),
    dpa_consent: bool = Form(...),
    resume_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Public direct application submission:
    - Rate-limited: 5 req/min per IP.
    - DPA consent required under UU PDP No. 27/2022.
    - Magic bytes validation for PDF/DOCX.
    - In-Memory Regex PII Sanitizer & Two-Way Dictionary Matching.
    - Envelope Encryption (AES-256-GCM) with unique DEK & Blind Indexing.
    - Generates anonymous tracking_token (UUIDv4) and masked_identifier (#TK-XXXXXX).
    """
    apply_rate_limiter.check_rate_limit(request)

    if not dpa_consent:
        raise HTTPException(
            status_code=400,
            detail="CONSENT_REQUIRED: Data Processing Agreement (DPA) consent is mandatory under UU PDP No. 27/2022."
        )

    # 1. Verify Job existence
    job_check = await db.execute(
        text("SELECT id, title FROM job_descriptions WHERE id = :id AND status = 'active'"),
        {"id": job_id},
    )
    job_row = job_check.mappings().first()
    if not job_row:
        raise HTTPException(status_code=404, detail="JOB_NOT_FOUND_OR_CLOSED")
    job_title = job_row["title"]

    # 2. Read & Validate file magic bytes
    file_bytes = await resume_file.read()
    file_format = validate_file_magic_bytes(file_bytes, resume_file.filename or "")
    file_hash = hashlib.sha256(file_bytes).hexdigest()

    # 3. Extract text in-memory
    raw_text = extract_text_from_file(file_bytes, file_format)

    # Audit hidden content (DOCX OOXML runs + PDF content streams). For PDFs this
    # also returns the cleaned visible text and flags image-only pages needing OCR.
    hidden_text_detected = False
    hidden_snippets: list[str] = []
    cleaned_body, hidden_snippets, pdf_audit = audit_document_hidden_text(file_bytes, file_format)
    if hidden_snippets:
        hidden_text_detected = True
        raw_text = cleaned_body
    elif pdf_audit is not None and pdf_audit.visible_text.strip():
        raw_text = cleaned_body

    # 4. Two-way dictionary matching PII sanitization
    sanitized_text, sanitize_stats = sanitize_pii(
        raw_text,
        known_name=name,
        known_email=email,
        known_phone=phone,
    )

    # 5. Crypto Envelope & Blind Indexing
    candidate_dek = generate_dek()
    enc_dek = encrypt_dek(candidate_dek)
    enc_name = encrypt_pii(name, candidate_dek)
    enc_email = encrypt_pii(email, candidate_dek)
    enc_phone = encrypt_pii(phone or "", candidate_dek) if phone else None
    email_blind_idx = compute_blind_index(email)

    masked_id = generate_masked_identifier()
    tracking_token = generate_tracking_token()

    # 6. Insert Candidate row
    insert_cand_stmt = text("""
        INSERT INTO candidates (
            job_id, encrypted_name, encrypted_email, encrypted_phone, encrypted_dek,
            email_blind_index, masked_identifier, tracking_token, resume_file_path,
            file_hash_sha256, github_url, portfolio_url, sanitized_resume_text,
            status, is_deleted, version
        ) VALUES (
            :job_id, :enc_name, :enc_email, :enc_phone, :enc_dek,
            :email_blind_idx, :masked_id, :tracking_token, :file_name,
            :file_hash, :github_url, :portfolio_url, :sanitized_text,
            'queued', FALSE, 1
        )
    """)
    res = await db.execute(
        insert_cand_stmt,
        {
            "job_id": job_id,
            "enc_name": enc_name,
            "enc_email": enc_email,
            "enc_phone": enc_phone,
            "enc_dek": enc_dek,
            "email_blind_idx": email_blind_idx,
            "masked_id": masked_id,
            "tracking_token": tracking_token,
            "file_name": resume_file.filename,
            "file_hash": file_hash,
            "github_url": github_url,
            "portfolio_url": portfolio_url,
            "sanitized_text": sanitized_text,
        },
    )
    candidate_id = res.lastrowid

    # 7. Insert Consent Record
    client_ip = apply_rate_limiter.get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "Unknown")
    consent_hash = hashlib.sha256(f"{email_blind_idx}_{client_ip}_{dpa_consent}".encode("utf-8")).hexdigest()

    await db.execute(
        text("""
            INSERT INTO consent_records (
                candidate_id, masked_identifier, consent_source, consent_given,
                consent_hash, ip_address, user_agent
            ) VALUES (
                :cand_id, :masked_id, 'direct_applicant', TRUE,
                :consent_hash, :ip_address, :user_agent
            )
        """),
        {
            "cand_id": candidate_id,
            "masked_id": masked_id,
            "consent_hash": consent_hash,
            "ip_address": client_ip,
            "user_agent": user_agent,
        },
    )

    # 8. Record Anomaly if hidden text was found
    if hidden_text_detected:
        await db.execute(
            text("""
                INSERT INTO candidate_anomalies (
                    candidate_id, anomaly_type, severity, description, suggested_verification
                ) VALUES (
                    :cand_id, 'PROMPT_INJECTION', 'HIGH',
                    :desc, 'Manually review raw DOCX structure for zero-font or vanish XML tags.'
                )
            """),
            {
                "cand_id": candidate_id,
                "desc": f"Hidden text / vanish tags detected in document: {json.dumps(hidden_snippets)}",
            },
        )
        # Update priority
        await db.execute(
            text("UPDATE candidates SET triage_priority = 'HIGH_ATTENTION' WHERE id = :id"),
            {"id": candidate_id},
        )

    # 8b. PDF-specific findings (invisible render mode, white text, micro images)
    if pdf_audit is not None and pdf_audit.findings:
        for finding in pdf_audit.findings:
            await db.execute(
                text("""
                    INSERT INTO candidate_anomalies (
                        candidate_id, anomaly_type, severity, description, suggested_verification
                    ) VALUES (
                        :cand_id, :atype, :sev, :desc, :verify
                    )
                """),
                {
                    "cand_id": candidate_id,
                    "atype": finding["type"],
                    "sev": finding.get("severity", "MEDIUM"),
                    "desc": f"PDF page {finding.get('page')}: {finding.get('excerpt', '')}",
                    "verify": "Inspect PDF content stream for invisible text or covert image objects.",
                },
            )
        if not hidden_text_detected:
            await db.execute(
                text("UPDATE candidates SET triage_priority = 'HIGH_ATTENTION' WHERE id = :id"),
                {"id": candidate_id},
            )

    # 8c. Scanned PDF with no text layer: downstream triage has nothing to score
    if pdf_audit is not None and pdf_audit.requires_ocr:
        await db.execute(
            text("""
                INSERT INTO candidate_anomalies (
                    candidate_id, anomaly_type, severity, description, suggested_verification
                ) VALUES (
                    :cand_id, 'PDF_REQUIRES_OCR', 'MEDIUM',
                    :desc, 'Request a text-based PDF/DOCX or run OCR before automated evaluation.'
                )
            """),
            {
                "cand_id": candidate_id,
                "desc": f"Pages without text layer: {pdf_audit.image_only_pages}",
            },
        )

    await db.commit()

    # Post-commit: acknowledge receipt to the applicant. Best-effort — a mail
    # outage must not fail an application that is already persisted.
    notification = {"sent": False, "reason": "EMAIL_NOT_CONFIGURED"}
    if email_service.configured and email:
        try:
            subject, html_body, text_body = application_received(
                masked_identifier=masked_id,
                job_title=job_title,
            )
            send_result = await email_service.send(email, subject, html_body, text_body)
            notification = {
                "sent": bool(send_result.get("sent")),
                "provider": send_result.get("provider"),
                "reason": send_result.get("reason"),
            }
        except Exception as exc:
            logger.warning("Application acknowledgement email failed: %s", type(exc).__name__)
            notification = {"sent": False, "reason": "EMAIL_SEND_ERROR"}

    return {
        "status": "success",
        "message": "Application submitted successfully and placed in triage queue.",
        "masked_identifier": masked_id,
        "tracking_token": tracking_token,
        "triage_status": "queued",
        "pii_sanitization_stats": sanitize_stats,
        "notification": notification,
    }


@router.get("/track/{tracking_token}")
async def track_application_status(tracking_token: str, db: AsyncSession = Depends(get_db)):
    """
    Public candidate status tracker using secret UUIDv4 tracking_token.
    Prevents sequential enumeration attacks.
    """
    res = await db.execute(
        text("""
            SELECT c.masked_identifier, c.status, c.recommendation, c.created_at,
                   j.title as job_title, j.department
            FROM candidates c
            JOIN job_descriptions j ON c.job_id = j.id
            WHERE c.tracking_token = :token AND c.is_deleted = FALSE
        """),
        {"token": tracking_token},
    )
    row = res.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="APPLICATION_NOT_FOUND_OR_WITHDRAWN")

    return {
        "masked_identifier": row["masked_identifier"],
        "job_title": row["job_title"],
        "department": row["department"],
        "status": row["status"],
        "recommendation": row["recommendation"],
        "submitted_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@router.post("/withdraw")
async def withdraw_application(
    request: Request,
    tracking_token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Public right-to-erasure / application withdrawal endpoint using secret tracking_token.
    Executes unified crypto-shredding via talentops_erasure.
    """
    res = await db.execute(
        text("SELECT id, masked_identifier, is_deleted FROM candidates WHERE tracking_token = :token"),
        {"token": tracking_token},
    )
    cand = res.mappings().first()
    if not cand or cand["is_deleted"]:
        raise HTTPException(status_code=404, detail="APPLICATION_NOT_FOUND_OR_ALREADY_WITHDRAWN")

    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "127.0.0.1")
    erasure_result = await execute_talentops_erasure(
        db=db,
        candidate_id=cand["id"],
        reason="APPLICANT_VOLUNTARY_WITHDRAWAL_VIA_PORTAL",
        ip_address=client_ip,
        user_id=1,
    )

    if not erasure_result.get("success"):
        raise HTTPException(status_code=400, detail=erasure_result.get("error", "ERASURE_FAILED"))

    await db.commit()
    return {
        "status": "success",
        "message": "Application withdrawn and personal data crypto-shredded under UU PDP No. 27/2022.",
        "masked_identifier": cand["masked_identifier"],
        "is_deleted": True,
    }
