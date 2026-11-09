"""
Outbound text moderation — GTNIC 2026, Ketentuan Karya butir 1.

Every guardrail in this codebase was inbound: PII sanitisation
(`core/sanitizer.py`), hidden-text detection (`core/hidden_text_detector.py`),
prompt-injection flagging (`core/prompt.py`). Nothing inspected the text the
system *emits*. This module covers that direction.

Two layers, deliberately split:

  - `check_patterns()` — always on, deterministic, cheap, unit-tested. Patterns are
    narrow (insult/permission constructions, not bare words): a bare "Cina" is a
    country and "kafir" appears in academic writing, so a wide list buys false
    positives that cut legitimate recruiter-facing output.
  - LLM classifier — optional, only for model-generated free text (interview
    questions, bias suggestions). Template-authored narration skips it: one extra
    gateway call per SSE tick costs more than the risk it covers.

Verbatim CV quotes (`context_narrative`, `metric_string`) must NEVER be checked
here. Filtering them breaks `CandidateExtractionSchema.apply_substring_guard` and
fabricates evidence. Callers must exclude those fields.
"""
import json
import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional

from app.core.config import settings
from app.core.llm_adapter import LLMAdapter
from app.core.prompt import clean_llm_json_response

logger = logging.getLogger(__name__)

# (label, pattern). Construction-level, not word-level. See module docstring.
BLOCKED_PATTERNS: List[tuple] = [
    (
        "SARA",
        re.compile(
            r"\b(?:dasar\s+(?:kafir|sesat|penjajah)"
            r"|(?:suku|agama|ras|etnis)\s+\S+\s+(?:lebih\s+)?(?:rendah|hina|kotor|tidak\s+pantas)"
            r"|(?:orang|bangsa|golongan)\s+\S+\s+(?:memang|memanglah)\s+(?:rendah|hina|kotor))\b",
            re.IGNORECASE,
        ),
    ),
    (
        "EXPLICIT",
        re.compile(
            r"\b(?:konten\s+pornografi|video\s+porno|konten\s+dewasa|seks\s+eksplisit"
            r"|memperkosa|pemerkosaan|pelecehan\s+seksual\s+terhadap)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "VIOLENCE",
        re.compile(
            r"\b(?:akan\s+(?:membunuh|membantai|menghabisi)"
            r"|mengancam\s+(?:membunuh|melukai|menghabisi)"
            r"|serangan\s+fisik\s+terhadap|ajakan\s+kekerasan)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "HARASSMENT",
        re.compile(
            r"\b(?:dasar\s+(?:bodoh|idiot|goblok|tolol|bangsat)"
            r"|(?:bodoh|idiot|goblok|tolol|bangsat)\s+(?:sekali|kalian|kamu|banget))\b",
            re.IGNORECASE,
        ),
    ),
]

# Replacement used when a narration string is withheld. Kept in Bahasa Indonesia to
# match every other user-facing string in this pipeline.
NARRATION_FALLBACK = (
    "Catatan penalaran agen tidak ditampilkan karena memuat frasa yang tidak lolos "
    "penyaring keluaran."
)

CLASSIFIER_SYSTEM_PROMPT = (
    "You are the outbound content moderator of an enterprise HR system.\n"
    "Classify the text as safe or unsafe for display to recruiters.\n"
    "Unsafe: hate speech against a group (SARA), sexual explicitness, violence, "
    "or personal provocation. Constructive, technical, or critical HR wording is safe.\n"
    "Return ONLY raw JSON: {\"safe\": true|false, \"category\": \"SARA|EXPLICIT|VIOLENCE|HARASSMENT|null\"}"
)


@dataclass(frozen=True)
class ModerationResult:
    """Verdict for one text. `mode` records which layers actually ran."""

    allowed: bool
    reason: Optional[str] = None
    flagged_terms: List[str] = field(default_factory=list)
    mode: str = "PATTERNS_ONLY"

    def as_payload(self) -> dict:
        return {
            "allowed": self.allowed,
            "reason": self.reason,
            "flagged_terms": list(self.flagged_terms),
            "mode": self.mode,
        }


def check_patterns(text: str, context: str = "") -> ModerationResult:
    """Deterministic layer. Always runs; must never raise."""
    if not text or not isinstance(text, str):
        return ModerationResult(allowed=True)

    hits: List[str] = []
    labels: List[str] = []
    for label, pattern in BLOCKED_PATTERNS:
        match = pattern.search(text)
        if match:
            labels.append(label)
            hits.append(match.group(0))

    if not hits:
        return ModerationResult(allowed=True)

    reason = f"BLOCKED_{labels[0]}"
    logger.warning("Outbound moderation blocked text (%s, context=%s): %s", reason, context, hits)
    return ModerationResult(allowed=False, reason=reason, flagged_terms=hits)


async def check(text: str, context: str = "", allow_llm: Optional[bool] = None) -> ModerationResult:
    """Patterns first; LLM classifier only for long model-generated free text.

    Any gateway failure degrades to the pattern verdict instead of blocking output —
    a broken moderator must not take down the pipeline.
    """
    pattern_verdict = check_patterns(text, context)
    if not pattern_verdict.allowed:
        return pattern_verdict

    use_llm = settings.MODERATION_LLM_ENABLED if allow_llm is None else allow_llm
    if not use_llm or not text or len(text) < settings.MODERATION_LLM_MIN_CHARS:
        return pattern_verdict

    try:
        adapter = LLMAdapter()
        response = await adapter.complete(
            messages=[
                {"role": "system", "content": CLASSIFIER_SYSTEM_PROMPT},
                {"role": "user", "content": text[:4000]},
            ],
            use_cache=False,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        verdict = json.loads(clean_llm_json_response(response["content"]))
    except Exception as exc:
        logger.warning("Moderation classifier unavailable (%s); patterns-only verdict used", exc)
        return pattern_verdict

    if verdict.get("safe") is False:
        category = str(verdict.get("category") or "UNCLASSIFIED").upper()
        logger.warning("Outbound moderation blocked text (BLOCKED_%s via LLM, context=%s)", category, context)
        return ModerationResult(
            allowed=False,
            reason=f"BLOCKED_{category}",
            flagged_terms=[],
            mode="HYBRID",
        )

    return ModerationResult(allowed=True, mode="HYBRID")


def scrub_narration(text: Optional[str]) -> tuple:
    """Patterns-only scrub for template-authored narration.

    Returns (text, reason). `reason` is None when the text passed. Used as the single
    choke point in the SSE broadcaster, so every agent narration is covered without
    paying an LLM call per published step.
    """
    if not text or not isinstance(text, str):
        return text, None
    verdict = check_patterns(text, context="sse.ai_thought")
    if verdict.allowed:
        return text, None
    return NARRATION_FALLBACK, verdict.reason
