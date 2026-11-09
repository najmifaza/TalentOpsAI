"""
LLM-generated adaptive interview questions.

The deterministic engine (`core/scoring.py`) emits one templated question per
candidate, chosen by a fixed threshold. Two candidates with different gaps can receive
the identical sentence, which makes the adaptive-assessment feature hard to defend in
a live demo.

This module asks the model for gap-probing questions that must point at evidence the
candidate actually produced, and validates the answer before it reaches the database:

  - `target_skill` must exist in the job's core competencies or the extracted claims,
    otherwise the model invented a topic and the question is dropped;
  - `difficulty_level` is normalised through `_match_enum` because
    `candidate_assessments.difficulty_level` is a strict ENUM and MariaDB runs with
    STRICT_TRANS_TABLES — one bad value aborts the whole triage transaction;
  - every question passes outbound moderation before being persisted.

Any failure returns None and the caller keeps the deterministic template. The feature
must never be the reason a triage run fails.
"""
import json
import logging
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.moderation import check as moderation_check
from app.core.prompt import clean_llm_json_response
from app.schemas.extraction import _match_enum

logger = logging.getLogger(__name__)

VALID_DIFFICULTY = {"L1_FUNDAMENTAL", "L2_SYSTEM_DESIGN", "L3_EDGE_CASE"}
DIFFICULTY_ALIASES = {
    "l1": "L1_FUNDAMENTAL",
    "fundamental": "L1_FUNDAMENTAL",
    "dasar": "L1_FUNDAMENTAL",
    "basic": "L1_FUNDAMENTAL",
    "l2": "L2_SYSTEM_DESIGN",
    "system design": "L2_SYSTEM_DESIGN",
    "desain sistem": "L2_SYSTEM_DESIGN",
    "intermediate": "L2_SYSTEM_DESIGN",
    "l3": "L3_EDGE_CASE",
    "edge case": "L3_EDGE_CASE",
    "studi kasus": "L3_EDGE_CASE",
    "advanced": "L3_EDGE_CASE",
}

MAX_QUESTIONS = 4
MAX_QUESTION_CHARS = 1500
MAX_CRITERIA_CHARS = 700

SYSTEM_PROMPT = """You are the adaptive technical assessor of TalentOps AI, an enterprise recruitment agent.
Generate gap-probing interview questions for ONE candidate, based only on the evidence supplied.

RULES:
1. Maximum 4 questions. Every question MUST target a skill listed in allowed_skills.
2. Every question MUST be anchored to one specific claim or evidence item given in the input.
   Never invent projects, employers, metrics, or technologies that are absent from the input.
3. Claims flagged as unverified, or without a measurable metric, get deeper probing
   (L2_SYSTEM_DESIGN or L3_EDGE_CASE), not easier assumptions.
4. NEVER ask about university, GPA, gender, age, marital status, ethnicity, or religion
   (UU Ketenagakerjaan No. 13/2003 anti-discrimination rule).
5. Write in Bahasa Indonesia, professional tone, recruiter-ready.
6. Output ONLY raw JSON, no markdown fences, no commentary.

Output schema:
{"questions": [
  {"target_skill": "exact string from allowed_skills",
   "difficulty_level": "L1_FUNDAMENTAL|L2_SYSTEM_DESIGN|L3_EDGE_CASE",
   "scenario_question": "question text",
   "evaluation_criteria": "what a strong answer must show",
   "follow_ups": ["probe 1", "probe 2"]}
]}"""


def _canonical_skill(raw: Any, allowed: Dict[str, str]) -> Optional[str]:
    """Maps a model-emitted skill onto the canonical spelling used by the job/claims."""
    if not isinstance(raw, str):
        return None
    return allowed.get(raw.strip().lower())


def _clean_text(value: Any, limit: int) -> Optional[str]:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    return text[:limit]


def _build_user_prompt(
    job_title: str,
    allowed_skills: List[str],
    claims: List[Dict[str, Any]],
    evidence_records: List[Dict[str, Any]],
    anomaly_details: List[Dict[str, Any]],
    recommendation: str,
    dimension_scores: Dict[str, Any],
) -> str:
    claim_rows = [
        {
            "technology": c.get("technology") or c.get("competency"),
            "verified": bool(c.get("has_implementation_detail")),
            "metric": c.get("metric_string"),
            "context": c.get("context_narrative"),
        }
        for c in claims[:15]
    ]
    evidence_rows = [
        {
            "target_competency": e.get("target_competency"),
            "matched_requirement": e.get("matched_requirement"),
            "verified": bool(e.get("verified")),
            "score_contribution": e.get("score_contribution"),
        }
        for e in evidence_records[:20]
    ]
    return json.dumps(
        {
            "job_title": job_title,
            "allowed_skills": allowed_skills,
            "recommendation": recommendation,
            "dimension_scores": dimension_scores,
            "claims": claim_rows,
            "evidence": evidence_rows,
            "anomalies": [
                {k: a.get(k) for k in ("type", "severity", "description")}
                for a in anomaly_details[:10]
            ],
        },
        ensure_ascii=False,
    )


async def generate_interview_questions(
    llm,
    *,
    job_title: str,
    core_competencies: List[str],
    claims: List[Dict[str, Any]],
    evidence_records: List[Dict[str, Any]],
    anomaly_details: Optional[List[Dict[str, Any]]] = None,
    recommendation: str = "",
    dimension_scores: Optional[Dict[str, Any]] = None,
    max_questions: int = MAX_QUESTIONS,
) -> Optional[Dict[str, Any]]:
    """Returns {"questions": [...], "model": str, "source": str} or None.

    Callers must treat None as "keep the deterministic template".
    """
    allowed: Dict[str, str] = {}
    for skill in core_competencies or []:
        if isinstance(skill, str) and skill.strip():
            allowed.setdefault(skill.strip().lower(), skill.strip())
    for claim in claims or []:
        name = claim.get("technology") or claim.get("competency")
        if isinstance(name, str) and name.strip() and name.strip() != "-":
            allowed.setdefault(name.strip().lower(), name.strip())

    if not allowed:
        return None

    try:
        response = await llm.complete(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": _build_user_prompt(
                        job_title,
                        sorted(allowed.values()),
                        claims or [],
                        evidence_records or [],
                        anomaly_details or [],
                        recommendation,
                        dimension_scores or {},
                    ),
                },
            ],
            use_cache=False,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        payload = json.loads(clean_llm_json_response(response["content"]))
    except Exception as exc:
        logger.warning("Interview question generation failed, deterministic template kept: %s", exc)
        return None

    raw_questions = payload.get("questions") if isinstance(payload, dict) else None
    if not isinstance(raw_questions, list):
        logger.warning("Interview generator returned no usable questions; template kept")
        return None

    questions: List[Dict[str, str]] = []
    for item in raw_questions:
        if not isinstance(item, dict):
            continue

        skill = _canonical_skill(item.get("target_skill"), allowed)
        if not skill:
            logger.info("Dropped generated question with unknown target_skill: %r", item.get("target_skill"))
            continue

        question = _clean_text(item.get("scenario_question"), MAX_QUESTION_CHARS)
        criteria = _clean_text(item.get("evaluation_criteria"), MAX_CRITERIA_CHARS)
        if not question or not criteria:
            continue

        follow_ups = [
            _clean_text(f, 300)
            for f in (item.get("follow_ups") or [])
            if isinstance(f, str)
        ]
        follow_ups = [f for f in follow_ups if f]
        if follow_ups:
            numbered = "\n".join(f"{i}. {f}" for i, f in enumerate(follow_ups[:3], start=1))
            question = f"{question}\n\nPertanyaan lanjutan:\n{numbered}"

        verdict = await moderation_check(question, context="interview_question")
        if not verdict.allowed:
            logger.info("Dropped generated question blocked by moderation: %s", verdict.reason)
            continue
        verdict_criteria = await moderation_check(criteria, context="interview_criteria")
        if not verdict_criteria.allowed:
            criteria = "Menilai kedalaman penerapan, penalaran analisis masalah, dan efektivitas solusi."

        questions.append(
            {
                "target_skill": skill,
                "difficulty_level": _match_enum(
                    item.get("difficulty_level"), VALID_DIFFICULTY, DIFFICULTY_ALIASES, "L1_FUNDAMENTAL"
                ),
                "scenario_question": question,
                "evaluation_criteria": criteria,
            }
        )
        if len(questions) >= max_questions:
            break

    if not questions:
        return None

    return {
        "questions": questions,
        "model": response.get("model") or settings.LLM_MODEL_NAME,
        "source": response.get("source", "LIVE"),
    }