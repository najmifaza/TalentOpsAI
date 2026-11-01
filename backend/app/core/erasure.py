import logging
from typing import Dict, Any, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.crypto import generate_tombstone_hash

logger = logging.getLogger(__name__)

async def execute_talentops_erasure(
    db: AsyncSession,
    candidate_id: int,
    reason: str,
    ip_address: str,
    user_id: Optional[int] = 1,
) -> Dict[str, Any]:
    """
    Unified Crypto-Shredding service compliant with UU PDP No. 27/2022 and PRD v2.5.2:
    1. Checks candidate existence and non-deleted status.
    2. Soft-deletes candidate (is_deleted = TRUE) without physical deletion.
    3. Destroys DEK (overwrites with zero-bytes) making AES-256-GCM ciphertext unrecoverable.
    4. Overwrites email_blind_index with random cryptographic tombstone hash.
    5. Nulls out sanitized_resume_text, file_hash_sha256, resume_file_path, urls.
    6. Purges relational artifacts: candidate_evidence and candidate_assessments.
    7. Frees any tentative interview slot held by candidate.
    8. Records immutable audit record in pii_access_logs.

    The stored original file is NOT deleted here: the caller must commit first, then
    call `delete_resume_file(result["stored_resume_name"])`. Deleting before commit
    would lose the document while the row still points at it if the commit fails.
    """
    cand_res = await db.execute(
        text("SELECT id, masked_identifier, resume_file_path, is_deleted FROM candidates WHERE id = :id"),
        {"id": candidate_id},
    )
    cand = cand_res.mappings().first()
    if not cand or cand["is_deleted"]:
        return {
            "success": False,
            "error": "CANDIDATE_NOT_FOUND_OR_ALREADY_DELETED",
            "candidate_id": candidate_id,
        }

    masked_id = cand["masked_identifier"]
    tombstone = generate_tombstone_hash()
    dead_dek = b"\x00" * 32

    # The original upload is a plain file on disk; the DB update below cannot
    # reach it. Hand the name back so the caller deletes it AFTER commit.
    stored_resume = cand.get("resume_file_path") if hasattr(cand, "get") else None

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
                masked_name_hint = NULL,
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
    await db.execute(text("DELETE FROM interview_scorecards WHERE candidate_id = :id"), {"id": candidate_id})

    # 3. Release any tentative interview slot held by candidate
    await db.execute(
        text("""
            UPDATE interview_slots
            SET status = 'available',
                candidate_id = NULL,
                tentative_expires_at = NULL,
                external_calendar_event_id = NULL
            WHERE candidate_id = :id AND status = 'tentative'
        """),
        {"id": candidate_id},
    )

    # 4. Append to pii_access_logs
    await db.execute(
        text("""
            INSERT INTO pii_access_logs (
                user_id, candidate_id, masked_identifier, reason, ip_address
            ) VALUES (
                :user_id, :cand_id, :masked_id, :reason, :ip
            )
        """),
        {
            "user_id": user_id or 1,
            "cand_id": candidate_id,
            "masked_id": masked_id,
            "reason": reason,
            "ip": ip_address,
        },
    )

    logger.info("TalentOps Erasure executed for candidate_id=%s, masked_id=%s, reason=%s", candidate_id, masked_id, reason)
    return {
        "success": True,
        "candidate_id": candidate_id,
        "masked_identifier": masked_id,
        "is_deleted": True,
        # Caller deletes this file after commit; never inside the transaction.
        "stored_resume_name": stored_resume,
        "message": "Candidate crypto-shredded successfully under UU PDP No. 27/2022.",
    }
