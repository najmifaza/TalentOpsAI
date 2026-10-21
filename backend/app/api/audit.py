import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import require_roles

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit-trail", tags=["Compliance & Audit Trail"])


@router.get("")
async def get_system_audit_trail(
    candidate_id: Optional[int] = Query(None, description="Filter jejak audit berdasarkan ID kandidat"),
    limit: int = Query(50, ge=1, le=200, description="Jumlah maksimal log"),
    offset: int = Query(0, ge=0, description="Offset paginasi"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "compliance_officer")),
):
    """
    PRD Bab 8.1 & Bab 6.1 (Item 6):
    Retrieves tamper-evident append-only audit trail logs.
    Aggregates autonomous agent steps, human review decisions, and PII access/erasure audits.
    """
    # 1. Fetch Agent Execution Steps
    agent_query = """
        SELECT id, run_id, candidate_id, masked_identifier, step_name,
               model_id, thinking_level, status, duration_ms, created_at
        FROM agent_steps
    """
    params = {}
    if candidate_id is not None:
        agent_query += " WHERE candidate_id = :candidate_id"
        params["candidate_id"] = candidate_id

    agent_query += " ORDER BY id DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    agent_res = await db.execute(text(agent_query), params)
    agent_logs = []
    for r in agent_res.mappings():
        agent_logs.append({
            "id": r["id"],
            "type": "AGENT_AUTONOMOUS_STEP",
            "run_id": r["run_id"],
            "candidate_id": r["candidate_id"],
            "masked_identifier": r["masked_identifier"],
            "step_name": r["step_name"],
            "model_id": r["model_id"],
            "status": r["status"],
            "duration_ms": r["duration_ms"],
            "timestamp": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"]),
        })

    # 2. Fetch Human Review Decisions
    rev_query = """
        SELECT r.id, r.candidate_id, c.masked_identifier, r.reviewer_id,
               u.username as reviewer_name, r.decision, r.notes, r.reviewed_at
        FROM human_reviews r
        JOIN candidates c ON r.candidate_id = c.id
        JOIN users u ON r.reviewer_id = u.id
    """
    rev_params = {}
    if candidate_id is not None:
        rev_query += " WHERE r.candidate_id = :candidate_id"
        rev_params["candidate_id"] = candidate_id

    rev_query += " ORDER BY r.id DESC LIMIT :limit"
    rev_params["limit"] = limit

    rev_res = await db.execute(text(rev_query), rev_params)
    review_logs = []
    for r in rev_res.mappings():
        review_logs.append({
            "id": r["id"],
            "type": "HUMAN_REVIEW_DECISION",
            "candidate_id": r["candidate_id"],
            "masked_identifier": r["masked_identifier"],
            "reviewer_name": r["reviewer_name"],
            "decision": r["decision"],
            "notes": r["notes"],
            "timestamp": r["reviewed_at"].isoformat() if hasattr(r["reviewed_at"], "isoformat") else str(r["reviewed_at"]),
        })

    # 3. Fetch PII Access / Erasure Logs
    pii_query = """
        SELECT p.id, p.user_id, u.username as authorized_user,
               p.candidate_id, p.masked_identifier, p.reason, p.ip_address, p.accessed_at
        FROM pii_access_logs p
        JOIN users u ON p.user_id = u.id
    """
    pii_params = {}
    if candidate_id is not None:
        pii_query += " WHERE p.candidate_id = :candidate_id"
        pii_params["candidate_id"] = candidate_id

    pii_query += " ORDER BY p.id DESC LIMIT :limit"
    pii_params["limit"] = limit

    pii_res = await db.execute(text(pii_query), pii_params)
    pii_logs = []
    for r in pii_res.mappings():
        pii_logs.append({
            "id": r["id"],
            "type": "PII_GOVERNANCE_ACCESS",
            "candidate_id": r["candidate_id"],
            "masked_identifier": r["masked_identifier"],
            "authorized_user": r["authorized_user"],
            "reason": r["reason"],
            "ip_address": r["ip_address"],
            "timestamp": r["accessed_at"].isoformat() if hasattr(r["accessed_at"], "isoformat") else str(r["accessed_at"]),
        })

    return {
        "status": "success",
        "summary": {
            "total_agent_steps": len(agent_logs),
            "total_human_reviews": len(review_logs),
            "total_pii_access_logs": len(pii_logs),
        },
        "logs": {
            "agent_steps": agent_logs,
            "human_reviews": review_logs,
            "pii_governance": pii_logs,
        },
        "compliance": {
            # Honest wording: no UPDATE/DELETE path exists in the application layer, but
            # there is no DB-level REVOKE or trigger yet, so do not claim one.
            "retention_policy": "Append-Only by application convention (DB-level REVOKE/trigger not yet enforced)",
            "legal_basis": "UU No. 27/2022 tentang Pelindungan Data Pribadi & ISO 27001",
        },
    }
