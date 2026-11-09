"""
Dual-model extraction cross-check — GTNIC 2026, indikator "Penalaran, Perencanaan,
dan Pengambilan Keputusan": menangani ambiguitas dan melakukan pemulihan otomatis.

`LLMAdapter.complete()` historically used `LLM_FALLBACK_MODEL` only *after* the
primary model failed outright, so a bad-but-plausible extraction was indistinguishable
from a good one. This module runs a second model on the same prompt and measures how
much the two agree. Agreement is a stability signal, not a truth score — two models can
agree and both be wrong, and the proposal says so.

No schema change: the score rides in the `llm_extraction` step payload, and a divergence
surfaces as a normal `candidate_anomalies` row plus a confidence downgrade.
"""
from typing import Any, Dict, List, Set

from app.core.scoring import normalize_technology_key
from app.schemas.extraction import CandidateExtractionSchema

# Below this, the extraction is treated as unstable and escalated to a human.
DIVERGENCE_THRESHOLD = 0.70

# Weights sum to 1.0. Skills carry the most because they feed the SKILL dimension
# (40% of the overall score by default); URLs carry little because a missing optional
# link says nothing about extraction quality.
WEIGHT_SKILL = 0.5
WEIGHT_TIMELINE = 0.2
WEIGHT_ANOMALY = 0.2
WEIGHT_URL = 0.1

FALLBACK_BY_LEVEL = {"HIGH": "MEDIUM", "MEDIUM": "LOW", "LOW": "LOW"}


def _jaccard(left: Set[str], right: Set[str]) -> float:
    """1.0 for two empty sets: absence on both sides is agreement, not divergence."""
    if not left and not right:
        return 1.0
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def _skill_set(schema: CandidateExtractionSchema) -> Set[str]:
    keys: Set[str] = set()
    for claim in schema.claims:
        name = claim.technology or claim.competency
        if name and name != "-":
            keys.add(normalize_technology_key(str(name)))
    keys.discard("")
    return keys


def _anomaly_set(schema: CandidateExtractionSchema) -> Set[str]:
    if not schema.anomalies:
        return set()
    dumped = schema.anomalies.model_dump()
    return {
        name
        for name, value in dumped.items()
        if name != "notes" and value is True
    }


def _timeline_score(primary: CandidateExtractionSchema, secondary: CandidateExtractionSchema) -> float:
    """Count-based, deliberately loose: models disagree on date formatting far more
    often than on how many jobs a CV lists, so comparing ranges would punish formatting."""
    difference = abs(len(primary.career_timeline) - len(secondary.career_timeline))
    if difference == 0:
        return 1.0
    if difference == 1:
        return 0.5
    return 0.0


def _url_score(primary: CandidateExtractionSchema, secondary: CandidateExtractionSchema) -> float:
    checks = 0.0
    pairs = 0
    for field_name in ("github_url", "portfolio_url"):
        left = getattr(primary, field_name, None)
        right = getattr(secondary, field_name, None)
        if not left and not right:
            continue
        pairs += 1
        checks += 1.0 if (left or "").strip().lower() == (right or "").strip().lower() else 0.0
    if pairs == 0:
        return 1.0
    return checks / pairs


def compare_extractions(
    primary: CandidateExtractionSchema,
    secondary: CandidateExtractionSchema,
) -> Dict[str, Any]:
    """Returns agreement in [0,1], `divergent`, and human-readable divergences."""
    primary_skills = _skill_set(primary)
    secondary_skills = _skill_set(secondary)
    skill_agreement = _jaccard(primary_skills, secondary_skills)

    primary_anomalies = _anomaly_set(primary)
    secondary_anomalies = _anomaly_set(secondary)
    anomaly_agreement = _jaccard(primary_anomalies, secondary_anomalies)

    timeline_agreement = _timeline_score(primary, secondary)
    url_agreement = _url_score(primary, secondary)

    agreement = (
        WEIGHT_SKILL * skill_agreement
        + WEIGHT_TIMELINE * timeline_agreement
        + WEIGHT_ANOMALY * anomaly_agreement
        + WEIGHT_URL * url_agreement
    )

    divergences: List[str] = []
    only_primary = primary_skills - secondary_skills
    only_secondary = secondary_skills - primary_skills
    if only_primary:
        divergences.append(
            "Hanya model utama yang menemukan: " + ", ".join(sorted(only_primary)[:5])
        )
    if only_secondary:
        divergences.append(
            "Hanya model kedua yang menemukan: " + ", ".join(sorted(only_secondary)[:5])
        )
    if timeline_agreement < 1.0:
        divergences.append(
            f"Jumlah riwayat kerja berbeda ({len(primary.career_timeline)} vs "
            f"{len(secondary.career_timeline)})"
        )
    anomaly_sym_diff = primary_anomalies.symmetric_difference(secondary_anomalies)
    if anomaly_sym_diff:
        divergences.append("Anomali berbeda: " + ", ".join(sorted(anomaly_sym_diff)[:4]))
    if url_agreement < 1.0:
        divergences.append("URL portofolio/GitHub yang diekstraksi berbeda")

    return {
        "agreement": round(agreement, 3),
        "divergent": agreement < DIVERGENCE_THRESHOLD,
        "threshold": DIVERGENCE_THRESHOLD,
        "skill_agreement": round(skill_agreement, 3),
        "timeline_agreement": round(timeline_agreement, 3),
        "anomaly_agreement": round(anomaly_agreement, 3),
        "url_agreement": round(url_agreement, 3),
        "divergences": divergences,
    }


def downgrade_confidence(level: str) -> str:
    """One step down the `candidates.confidence_level` enum (HIGH|MEDIUM|LOW)."""
    return FALLBACK_BY_LEVEL.get((level or "").upper(), "LOW")


def build_divergence_anomaly(comparison: Dict[str, Any], models: Dict[str, str]) -> Dict[str, Any]:
    """Row for `candidate_anomalies`. Kept here so the wording lives next to the metric."""
    detail = "; ".join(comparison.get("divergences", [])) or "Perbedaan tidak dapat dirinci."
    return {
        "type": "LOW_CONFIDENCE_EXTRACTION",
        "severity": "MEDIUM",
        "description": (
            "Dua model ekstraksi menghasilkan pembacaan CV yang berbeda "
            f"(kesepakatan {comparison.get('agreement')}/1.0, ambang "
            f"{comparison.get('threshold')}). {detail}"
        ),
        "suggested_verification": (
            "Buka rekaman penalaran AI pada tahap ekstraksi, bandingkan klaim dari kedua model "
            f"({models.get('primary', 'utama')} vs {models.get('crosscheck', 'pembanding')}), "
            "lalu konfirmasi keahlian yang diperdebatkan pada sesi wawancara."
        ),
    }