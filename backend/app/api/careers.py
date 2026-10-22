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
    decrypt_dek,
    decrypt_pii,
    compute_blind_index,
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
    delete_resume_file,
)
from app.core.rate_limiter import apply_rate_limiter
from app.core.scoring import DeterministicScoringEngine, inclusivity_from_findings
from app.core.erasure import execute_talentops_erasure
from app.core.email import email_service
from app.core.email_templates import application_received, erasure_confirmation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/careers", tags=["Public Career Portal"])


def _job_public_row(row) -> dict:
    """Kolom lowongan yang aman dan relevan untuk portal publik."""
    comp = row["core_competencies"]
    if isinstance(comp, str):
        try:
            comp = json.loads(comp)
        except Exception:
            comp = []

    raw_findings = row["flagged_ambiguities"] if "flagged_ambiguities" in row.keys() else None
    audited = raw_findings is not None
    findings = raw_findings
    if isinstance(findings, str):
        try:
            findings = json.loads(findings)
        except Exception:
            findings = []
    findings = findings or []
    inclusivity_score, inclusivity_rating = inclusivity_from_findings(findings)

    return {
        "id": row["id"],
        "title": row["title"],
        "department": row["department"],
        "raw_text": row["raw_text"],
        "core_competencies": comp,
        "status": row["status"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "company_name": row["company_name"],
        "company_logo_url": row["company_logo_url"],
        "company_industry": row["company_industry"],
        "job_function": row["job_function"],
        "employment_level": row["employment_level"],
        "location": row["location"],
        "deadline": row["deadline"].isoformat() if row["deadline"] else None,
        "description_text": row["description_text"],
        "requirements_text": row["requirements_text"],
        "company_about": row["company_about"],
        "company_address": row["company_address"],
        "company_website": row["company_website"],
        # Audit bias hanya ditampilkan kalau rekruter pernah menjalankannya.
        # NULL berarti "belum diaudit", bukan "skor 100".
        "bias_audit": (
            {
                "inclusivity_score": inclusivity_score,
                "inclusivity_rating": inclusivity_rating,
                "total_flags": len(findings),
                "categories": sorted({f.get("category") for f in findings if f.get("category")}),
            }
            if audited
            else None
        ),
    }


PUBLIC_JOB_COLUMNS = """
    id, title, department, raw_text, core_competencies, flagged_ambiguities, status, created_at,
    company_name, company_logo_url, company_industry, job_function, employment_level,
    location, deadline, description_text, requirements_text,
    company_about, company_address, company_website
"""


PUBLIC_RULE_LABELS = {
    "Aturan 1 (Kandidat Unggul)": "Seluruh syarat utama terpenuhi dengan bukti yang dapat diverifikasi.",
    "Aturan 2 (Ambang Kritis / Anomali)": "Kompetensi cukup, namun ada bagian yang perlu dikonfirmasi tim HR.",
    "Aturan 3 (Kandidat Kompeten Standard)": "Kompetensi memenuhi ambang minimum yang ditetapkan lowongan.",
    "Aturan 4 (Eliminasi Kelayakan)": "Skor keseluruhan belum mencapai ambang minimum lowongan.",
}


def public_rule_label(rule: str | None) -> str | None:
    """Kalimat publik untuk nama aturan internal, bukan nama aturannya."""
    if not rule:
        return None
    return PUBLIC_RULE_LABELS.get(rule, "Penilaian mengikuti ambang batas yang ditetapkan lowongan.")


@router.get("")
async def list_active_jobs(
    q: Optional[str] = None,
    company: Optional[str] = None,
    job_function: Optional[str] = None,
    employment_level: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Public list of active job descriptions, filterable by keyword/company/function/level."""
    where = ["status = 'active'"]
    params: dict = {}

    if q and q.strip():
        where.append("(title LIKE :q OR company_name LIKE :q OR raw_text LIKE :q)")
        params["q"] = f"%{q.strip()}%"
    if company:
        where.append("company_name = :company")
        params["company"] = company
    if job_function:
        where.append("job_function = :job_function")
        params["job_function"] = job_function
    if employment_level:
        where.append("employment_level = :employment_level")
        params["employment_level"] = employment_level

    res = await db.execute(
        text(f"SELECT {PUBLIC_JOB_COLUMNS} FROM job_descriptions WHERE {' AND '.join(where)} ORDER BY created_at DESC"),
        params,
    )
    jobs = [_job_public_row(row) for row in res.mappings()]

    # Opsi filter diturunkan dari hasil, jadi frontend tidak butuh endpoint sendiri.
    return {
        "data": jobs,
        "total": len(jobs),
        "filters": {
            "companies": sorted({j["company_name"] for j in jobs if j["company_name"]}),
            "functions": sorted({j["job_function"] for j in jobs if j["job_function"]}),
            "levels": sorted({j["employment_level"] for j in jobs if j["employment_level"]}),
        },
    }


@router.get("/{job_id}")
async def get_job_detail(job_id: int, db: AsyncSession = Depends(get_db)):
    """Public detail of single active job description."""
    res = await db.execute(
        text(f"SELECT {PUBLIC_JOB_COLUMNS} FROM job_descriptions WHERE id = :id AND status = 'active'"),
        {"id": job_id},
    )
    job = res.mappings().first()
    if not job:
        raise HTTPException(status_code=404, detail="JOB_NOT_FOUND_OR_CLOSED")

    return _job_public_row(job)


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
    sanitize_result = sanitize_resume(
        raw_text,
        known_name=name,
        known_email=email,
        known_phone=phone,
    )
    sanitized_text = sanitize_result.text
    sanitize_stats = sanitize_result.stats

    # 5. Crypto Envelope & Blind Indexing
    candidate_dek = generate_dek()
    enc_dek = encrypt_dek(candidate_dek)
    enc_name = encrypt_pii(name, candidate_dek)
    enc_email = encrypt_pii(email, candidate_dek)
    enc_phone = encrypt_pii(phone or "", candidate_dek) if phone else None
    email_blind_idx = compute_blind_index(email)

    masked_id = generate_masked_identifier()
    tracking_token = generate_tracking_token()

    # Keep the applicant's original document: the dossier renders it, and
    # erasure deletes it. Stored under an opaque name, not the upload filename.
    stored_name = save_resume_bytes(file_bytes, file_format)
    name_hint = mask_name(name)

    # 6. Insert Candidate row
    insert_cand_stmt = text("""
        INSERT INTO candidates (
            job_id, encrypted_name, encrypted_email, encrypted_phone, encrypted_dek,
            email_blind_index, masked_identifier, tracking_token, resume_file_path,
            file_hash_sha256, github_url, portfolio_url, sanitized_resume_text,
            masked_name_hint, status, is_deleted, version
        ) VALUES (
            :job_id, :enc_name, :enc_email, :enc_phone, :enc_dek,
            :email_blind_idx, :masked_id, :tracking_token, :file_name,
            :file_hash, :github_url, :portfolio_url, :sanitized_text,
            :name_hint, 'queued', FALSE, 1
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
            "file_name": stored_name,
            "file_hash": file_hash,
            "github_url": github_url,
            "portfolio_url": portfolio_url,
            "sanitized_text": sanitized_text,
            "name_hint": name_hint,
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
    # One row per anomaly type, not per finding: a marker reused across pages would
    # otherwise insert one row per occurrence and flood the dashboard badges.
    if pdf_audit is not None and pdf_audit.findings:
        grouped: dict[str, dict] = {}
        for finding in pdf_audit.findings:
            ftype = finding["type"]
            entry = grouped.setdefault(
                ftype,
                {"count": 0, "pages": set(), "severity": finding.get("severity", "MEDIUM"), "excerpt": finding.get("excerpt", "")},
            )
            entry["count"] += finding.get("occurrences", 1)
            if finding.get("page") is not None:
                entry["pages"].add(finding["page"])
            if entry["severity"] != "HIGH":
                entry["severity"] = finding.get("severity", entry["severity"])

        for ftype, entry in grouped.items():
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
                    "cand_id": candidate_id,
                    "atype": ftype,
                    "sev": entry["severity"],
                    "desc": (
                        f"{entry['count']} occurrence(s) on page(s) "
                        f"{pages if pages else 'n/a'}: {entry['excerpt']}"
                    ),
                    "verify": "Inspect PDF content stream for invisible text or covert image objects.",
                },
            )
        # Escalate only on a HIGH-severity finding. A MEDIUM micro-image is a
        # hint for review, not evidence of manipulation; promoting every PDF
        # finding buried clean CVs under HIGH_ATTENTION.
        if not hidden_text_detected and any(
            entry["severity"] == "HIGH" for entry in grouped.values()
        ):
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
        "pii_sanitization": {
            "name_source": sanitize_result.name_source,
            "residual_risk": sanitize_result.has_residual_risk,
            "limitations": sanitize_result.limitations,
        },
        "notification": notification,
    }


@router.get("/track/{tracking_token}")
async def track_application_status(tracking_token: str, db: AsyncSession = Depends(get_db)):
    """
    Public candidate status tracker using secret UUIDv4 tracking_token.
    Prevents sequential enumeration attacks.

    Yang dibuka ke pelamar: status, rekomendasi, keyakinan, tingkat risiko,
    skor per dimensi, dan aturan keputusan yang dipakai. Yang TIDAK dibuka:
    kutipan CV (claim_text), detail anomali keamanan, dan tautan repositori.
    """
    res = await db.execute(
        text("""
            SELECT c.masked_identifier, c.status, c.recommendation, c.created_at,
                   c.overall_score, c.confidence_level, c.unresolved_risk, c.dimension_scores,
                   j.title as job_title, j.department, j.weight_config
            FROM candidates c
            JOIN job_descriptions j ON c.job_id = j.id
            WHERE c.tracking_token = :token AND c.is_deleted = FALSE
        """),
        {"token": tracking_token},
    )
    row = res.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="APPLICATION_NOT_FOUND_OR_WITHDRAWN")

    dims = row["dimension_scores"]
    if isinstance(dims, str):
        try:
            dims = json.loads(dims)
        except Exception:
            dims = None

    overall = float(row["overall_score"]) if row["overall_score"] is not None else None
    confidence = row["confidence_level"]
    risk = row["unresolved_risk"]
    recommendation = row["recommendation"]

    weights = row["weight_config"]
    if isinstance(weights, str):
        try:
            weights = json.loads(weights)
        except Exception:
            weights = None
    weights = weights or DeterministicScoringEngine.DEFAULT_WEIGHTS

    # Alasan keputusan dihitung ulang dari skor tersimpan, bukan disimpan sebagai
    # kolom baru: satu sumber kebenaran tetap scoring.py. has_prompt_injection
    # sengaja False supaya pelamar tidak pernah melihat label "Security Quarantine".
    decision_rule = None
    if overall is not None and confidence and risk and recommendation:
        _, _, decision_rule = DeterministicScoringEngine.evaluate_decision_points(
            overall_score=overall,
            confidence=confidence,
            risk=risk,
            has_prompt_injection=False,
        )

    return {
        "masked_identifier": row["masked_identifier"],
        "job_title": row["job_title"],
        "department": row["department"],
        "status": row["status"],
        "recommendation": recommendation,
        "submitted_at": row["created_at"].isoformat() if row["created_at"] else None,
        # Null selama masih queued/analyzing: jangan tampilkan 0.0 seolah sudah dinilai.
        "assessment": (
            {
                "overall_score": overall,
                "dimension_scores": {
                    "SKILL": float((dims or {}).get("SKILL", 0.0)),
                    "EXPERIENCE": float((dims or {}).get("EXPERIENCE", 0.0)),
                    "EDUCATION": float((dims or {}).get("EDUCATION", 0.0)),
                    "PORTFOLIO": float((dims or {}).get("PORTFOLIO", 0.0)),
                },
                # Bobot ikut dikirim: tanpa ini total 88.67 tidak bisa dicocokkan
                # dengan rata-rata empat bar (82.92), dan pelamar menyimpulkan
                # angkanya salah.
                "weights": {
                    "SKILL": float(weights.get("SKILL", 0.4)),
                    "EXPERIENCE": float(weights.get("EXPERIENCE", 0.3)),
                    "EDUCATION": float(weights.get("EDUCATION", 0.1)),
                    "PORTFOLIO": float(weights.get("PORTFOLIO", 0.2)),
                },
                "confidence_level": confidence,
                "unresolved_risk": risk,
                "decision_rule": decision_rule,
                # Label publik untuk aturan internal ("Aturan 1 (Kandidat Unggul)").
                "decision_reason": public_rule_label(decision_rule),
            }
            if overall is not None
            else None
        ),
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
        text("""
            SELECT id, masked_identifier, is_deleted, encrypted_email, encrypted_dek,
                   job_id
            FROM candidates WHERE tracking_token = :token
        """),
        {"token": tracking_token},
    )
    cand = res.mappings().first()
    if not cand or cand["is_deleted"]:
        raise HTTPException(status_code=404, detail="APPLICATION_NOT_FOUND_OR_ALREADY_WITHDRAWN")

    # Capture the recipient before crypto-shredding destroys the DEK, otherwise
    # the confirmation can never be delivered.
    erasure_recipient = ""
    erasure_job_title = "Posisi Rekrutmen"
    if email_service.configured:
        try:
            dek = decrypt_dek(cand["encrypted_dek"])
            if cand["encrypted_email"]:
                erasure_recipient = decrypt_pii(cand["encrypted_email"], dek)
        except Exception as exc:
            logger.warning("Cannot decrypt recipient before erasure: %s", type(exc).__name__)
        try:
            job_res = await db.execute(
                text("SELECT title FROM job_descriptions WHERE id = :jid"),
                {"jid": cand["job_id"]},
            )
            job_row = job_res.mappings().first()
            if job_row and job_row["title"]:
                erasure_job_title = job_row["title"]
        except Exception:
            pass

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

    # After commit only: deleting earlier would strand the file if the commit
    # failed, leaving a live row pointing at a document that no longer exists.
    stored_resume_name = erasure_result.pop("stored_resume_name", None)
    if stored_resume_name:
        delete_resume_file(stored_resume_name)

    # Post-commit confirmation. The recipient was captured before the shred, so
    # this still works after the DEK is destroyed.
    if erasure_recipient:
        try:
            subject, html_body, text_body = erasure_confirmation(
                masked_identifier=cand["masked_identifier"],
                job_title=erasure_job_title,
            )
            await email_service.send(erasure_recipient, subject, html_body, text_body)
        except Exception as exc:
            logger.warning("Erasure confirmation email failed: %s", type(exc).__name__)

    return {
        "status": "success",
        "message": "Application withdrawn and personal data crypto-shredded under UU PDP No. 27/2022.",
        "masked_identifier": cand["masked_identifier"],
        "is_deleted": True,
    }
