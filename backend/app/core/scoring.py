import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

# ==============================================================================
# 1. TAXONOMY & EQUIVALENCE MAPPING
# ==============================================================================
# Exact match = 1.0, Ecosystem match = 0.7, Irrelevant = 0.0
SKILL_TAXONOMY_MAP: Dict[str, Set[str]] = {
    "fastapi": {"python", "django", "flask", "express", "starlette", "rest", "aiohttp", "tornado"},
    "python": {"fastapi", "django", "flask", "pandas", "numpy", "pytorch"},
    "docker": {"kubernetes", "podman", "container", "containerization", "k8s"},
    "postgresql": {"mariadb", "mysql", "sql", "sqlite", "relational database", "rdbms"},
    "mariadb": {"mysql", "postgresql", "sql", "sqlite"},
    "mysql": {"mariadb", "postgresql", "sql"},
    "ci/cd": {"github actions", "gitlab ci", "jenkins", "argocd", "devops"},
    "redis": {"memcached", "cache", "key-value store"},
    "go": {"golang", "rust"},
    "kafka": {"rabbitmq", "sqs", "event-driven", "pubsub"},
    "react": {"vue", "next.js", "frontend", "typescript", "javascript"},
}

# Build bidirectional taxonomy lookup for symmetric matching
_BIDIRECTIONAL_TAXONOMY: Dict[str, Set[str]] = {}
for _k, _vals in SKILL_TAXONOMY_MAP.items():
    _k_norm = _k.strip().lower()
    _BIDIRECTIONAL_TAXONOMY.setdefault(_k_norm, set()).update(v.strip().lower() for v in _vals)
    for _v in _vals:
        _v_norm = _v.strip().lower()
        _BIDIRECTIONAL_TAXONOMY.setdefault(_v_norm, set()).add(_k_norm)

METRIC_PATTERN = re.compile(
    r"(?i)(?<![\w.])(?:\d+(?:[.,]\d+)*\+?\s?(?:%|x|ms|sec|detik|rps|qps|tps|req/s|users?|pengguna|k|jt|juta|miliar|m|b|rb|ribu|transaksi|dokumen|kontrak|klien|peserta|karyawan|leads)(?![a-z0-9])|(?:rp|\$|idr|usd)\s?\d[\d.,]*)"
)

CONTEXT_KEYWORDS = {
    # Engineering & Tech
    "latency", "throughput", "waktu", "biaya", "error", "uptime", "availability",
    "user", "users", "pengguna", "beban", "request", "requests", "query",
    "performa", "akurasi", "memory", "cpu", "rps", "qps", "tps",
    # Finance, Sales & Marketing
    "omzet", "revenue", "penjualan", "closing", "leads", "anggaran", "budget", "margin",
    "miliar", "juta", "transaksi", "fiskal", "pajak", "roi", "cpa", "cpc", "roas",
    # Operations & Supply Chain
    "sla", "turnaround", "stok", "efisiensi", "inventory", "volume", "pengiriman", "logistik",
    # HR & Management
    "karyawan", "retensi", "turnover", "headcount", "kepuasan", "nps", "rekrutmen", "talent",
    # Legal & Governance
    "kontrak", "klausul", "sengketa", "audit", "kepatuhan", "regulasi", "perjanjian", "dokumen",
    # Business Growth
    "mitra", "proyek", "target", "pertumbuhan", "growth"
}


def inclusivity_from_findings(findings: list[dict]) -> tuple[int, str]:
    """
    Score inklusivitas dari daftar temuan bias (lihat analyze-bias di api/jobs.py).

    Single source of truth: endpoint audit dan portal publik sama-sama memakai
    fungsi ini, supaya skor yang tersimpan dan yang tampil ke pelamar tidak
    pernah berbeda. HIGH -15, MEDIUM -8, LOW -4.
    """
    penalty = 0
    for finding in findings:
        if not isinstance(finding, dict):
            continue
        severity = str(finding.get("severity") or "").strip().upper()
        if severity == "HIGH":
            penalty += 15
        elif severity == "MEDIUM":
            penalty += 8
        elif severity == "LOW":
            penalty += 4
        elif severity:
            penalty += 4

    score = max(0, 100 - penalty)
    if score >= 90:
        rating = "EXCELLENT"
    elif score >= 75:
        rating = "GOOD"
    else:
        rating = "NEEDS_REVISION"
    return score, rating


# ==============================================================================
# 2. HELPER FUNCTIONS
# ==============================================================================
def _has_term(text: str, term: str) -> bool:
    """Checks if term appears in text with boundary constraints (not substring of larger word)."""
    if not text or not term:
        return False
    return re.search(rf"(?<![a-z0-9+#.]){re.escape(term)}(?![a-z0-9+#.])", text) is not None


def calculate_relevance(
    claimed_tech: str,
    required_comp: str,
    dynamic_taxonomy: Optional[Dict[str, Any]] = None,
) -> float:
    """Returns 1.0 for exact match, 0.7 for ecosystem/synonym equivalent, 0.0 otherwise."""
    claimed = claimed_tech.strip().lower()
    required = required_comp.strip().lower()

    if not claimed or not required:
        return 0.0

    if claimed == required or _has_term(claimed, required):
        return 1.0

    # 1. Check dynamic taxonomies if available (case-insensitive)
    if dynamic_taxonomy and isinstance(dynamic_taxonomy, dict):
        dyn_set: Set[str] = set()
        for k, v in dynamic_taxonomy.items():
            if k.strip().lower() == required:
                if isinstance(v, (list, set, tuple)):
                    dyn_set.update(str(item).strip().lower() for item in v if str(item).strip())
                elif isinstance(v, str) and v.strip():
                    dyn_set.add(v.strip().lower())
        if claimed in dyn_set:
            return 0.7
        for item in dyn_set:
            if _has_term(claimed, item) or _has_term(item, claimed):
                return 0.7

    # 2. Check bidirectional static fallback SKILL_TAXONOMY_MAP
    equivalents = _BIDIRECTIONAL_TAXONOMY.get(required, set())
    if claimed in equivalents:
        return 0.7

    for eq in equivalents:
        if _has_term(claimed, eq) or _has_term(eq, claimed):
            return 0.7

    return 0.0


def is_tier3_metric_claim(context_narrative: Optional[str], metric_string: Optional[str]) -> bool:
    """
    Tier 3 Condition 1:
    Regex matches a measurable unit AND sentence contains a performance/business context word.
    Eliminates fluff like '100% dedicated to quality'.
    """
    combined = f"{context_narrative or ''} {metric_string or ''}".strip().lower()
    if not combined:
        return False

    metric_match = METRIC_PATTERN.search(combined)
    if not metric_match:
        return False

    remaining_text = METRIC_PATTERN.sub(" ", combined)
    has_context_word = any(
        re.search(rf"(?<![a-z0-9]){re.escape(word)}(?![a-z0-9])", remaining_text)
        for word in CONTEXT_KEYWORDS
    )
    if not has_context_word:
        has_context_word = any(
            re.search(rf"(?<![a-z0-9]){re.escape(word)}(?![a-z0-9])", combined)
            for word in (CONTEXT_KEYWORDS - {"karyawan", "dokumen"})
        )
    return has_context_word


PRESENT_TERMS = {"present", "sekarang", "current", "now", "saat ini"}
DATE_PATTERN = re.compile(r"^(\d{4})(?:[-/](\d{1,2}))?(?:[-/]\d{1,2})?$")
MONTH_NAME_MAP = {
    "jan": 1, "januari": 1, "january": 1,
    "feb": 2, "februari": 2, "february": 2,
    "mar": 3, "maret": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5, "mei": 5,
    "jun": 6, "juni": 6, "june": 6,
    "jul": 7, "juli": 7, "july": 7,
    "aug": 8, "agu": 8, "agustus": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "oktober": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "desember": 12, "december": 12,
}
MONTH_TEXT_PATTERN = re.compile(r"^([a-z]+)[,\s/-]+(\d{4})$|^(\d{4})[,\s/-]+([a-z]+)$")


def parse_date_to_months(
    date_val: Any,
    *,
    as_of: Optional[datetime] = None,
    end_of_period: bool = False,
) -> Optional[int]:
    """
    Converts YYYY-MM, YYYY, month names (e.g. 'Jan 2023', 'Mei 2021'), or present string into absolute month count from Year 0.
    Returns None for invalid or unparseable input (no silent Jan guessing).
    """
    if date_val is None:
        return None
    cleaned = str(date_val).strip().lower()
    if cleaned in ("none", "null", ""):
        return None

    now = as_of or datetime.now()
    if cleaned in PRESENT_TERMS:
        return now.year * 12 + now.month

    # Check text month e.g. "Jan 2022" or "2022 Jan"
    tm = MONTH_TEXT_PATTERN.match(cleaned)
    if tm:
        m_str = tm.group(1) or tm.group(4)
        y_str = tm.group(2) or tm.group(3)
        month = MONTH_NAME_MAP.get(m_str)
        if month:
            return int(y_str) * 12 + month

    m = DATE_PATTERN.match(cleaned)
    if not m:
        return None

    year = int(m.group(1))
    if m.group(2):
        month = int(m.group(2))
    else:
        month = 12 if end_of_period else 1

    if 1 <= month <= 12:
        return year * 12 + month
    return None


def normalize_technology_key(name: str) -> str:
    """Identity of a technology name for dedupe: retains + and # (C++, C# != C), collapses dots (Next.js == nextjs)."""
    return re.sub(r"[^a-z0-9+#]", "", (name or "").lower())


def months_to_label(months: Optional[int]) -> str:
    """Inverse of parse_date_to_months: absolute month count back to YYYY-MM."""
    if months is None:
        return "-"
    year = months // 12
    month = months - year * 12
    if month == 0:
        year -= 1
        month = 12
    return f"{year:04d}-{month:02d}"


def merge_employment_intervals(
    timeline: List[Dict[str, Any]],
    as_of: Optional[datetime] = None,
) -> float:
    """
    PRD Bab 5.2 Interval Merging:
    Merges overlapping work periods on relevant engineering roles to prevent double-counting.
    Returns aggregated experience in years.
    """
    now = as_of or datetime.now()
    now_m = now.year * 12 + now.month
    intervals: List[Tuple[int, int]] = []

    for item in timeline:
        if not isinstance(item, dict):
            continue
        if not item.get("is_relevant_role", True):
            continue

        raw_start = item.get("start")
        raw_end = item.get("end")
        if raw_end is None or str(raw_end).strip().lower() in ("none", "null", ""):
            raw_end = "present"

        start_m = parse_date_to_months(raw_start, as_of=now, end_of_period=False)
        end_m = parse_date_to_months(raw_end, as_of=now, end_of_period=True)

        if start_m is None or end_m is None:
            continue

        # Clamp future date to current month
        if end_m > now_m:
            end_m = now_m
        if start_m > now_m:
            start_m = now_m

        if end_m < start_m:
            end_m = start_m

        intervals.append((start_m, end_m))

    if not intervals:
        return 0.0

    # Sort intervals by start month
    intervals.sort(key=lambda x: x[0])

    merged: List[Tuple[int, int]] = [intervals[0]]
    for current in intervals[1:]:
        prev_start, prev_end = merged[-1]
        cur_start, cur_end = current

        if cur_start <= prev_end:
            # Overlapping or contiguous interval
            merged[-1] = (prev_start, max(prev_end, cur_end))
        else:
            merged.append(current)

    total_months = sum((end - start + 1) for start, end in merged)
    return round(max(0.0, total_months / 12.0), 2)


# ==============================================================================
# 3. DETERMINISTIC 4D SCORING ENGINE
# ==============================================================================
class DeterministicScoringEngine:
    """
    Pure Python deterministic calculation of 4D Candidate Scores (PRD Bab 5.2):
    - S_comp (Skills Coverage & Taxonomy)
    - S_exp (Experience Piecewise Linear)
    - S_edu (Education Scalar)
    - S_port (Portfolio Top Verified Repo)
    """

    DEFAULT_WEIGHTS = {
        "SKILL": 0.4,
        "EXPERIENCE": 0.3,
        "EDUCATION": 0.1,
        "PORTFOLIO": 0.2,
    }

    @classmethod
    def calculate_skill_score(
        cls,
        claims: List[Dict[str, Any]],
        core_competencies: List[str],
        verified_github_repos: Optional[Dict[str, Any]] = None,
        dynamic_taxonomy: Optional[Dict[str, Any]] = None,
    ) -> Tuple[float, List[Dict[str, Any]]]:
        """
        S_comp = (sum(MatchScore_k) / M) * 100
        MatchScore(k) = max(TierScore_i / 100.0 * Relevance_ik)
        """
        if not core_competencies:
            return 50.0, []

        verified_repos = verified_github_repos or {}
        evidence_records: List[Dict[str, Any]] = []
        match_scores: List[float] = []
        matched_technologies: set = set()

        for req_comp in core_competencies:
            best_match_score = 0.0
            best_claim: Optional[Dict[str, Any]] = None
            best_tier = 0.0

            for claim in claims:
                tech = claim.get("technology") or claim.get("competency") or ""
                relevance = calculate_relevance(tech, req_comp, dynamic_taxonomy)
                if relevance == 0.0:
                    continue

                has_impl = claim.get("has_implementation_detail", False)
                narrative = claim.get("context_narrative")
                metric = claim.get("metric_string")
                repo_url = claim.get("repo_url")

                # Determine tier score
                if not has_impl:
                    tier_score = 20.0  # Tier 1
                else:
                    is_t3_metric = is_tier3_metric_claim(narrative, metric)
                    is_t3_repo = False
                    if repo_url and repo_url in verified_repos:
                        repo_info = verified_repos[repo_url]
                        is_t3_repo = repo_info.get("verified", False) and not repo_info.get("is_fork", False)

                    if is_t3_metric or is_t3_repo:
                        tier_score = 100.0  # Tier 3
                    else:
                        tier_score = 60.0  # Tier 2

                score_contrib = (tier_score / 100.0) * relevance
                if score_contrib > best_match_score:
                    best_match_score = score_contrib
                    best_claim = claim
                    best_tier = tier_score

            match_scores.append(best_match_score)
            if best_claim:
                conf = 1.00 if best_tier == 100.0 else (0.75 if best_tier == 60.0 else 0.50)
                claim_tech = (best_claim.get("technology") or best_claim.get("competency") or req_comp).strip()
                matched_technologies.add(normalize_technology_key(claim_tech))
                evidence_records.append({
                    "dimension": "SKILL",
                    # The CV's own wording, not the posting's requirement label: a CV
                    # saying "Next.js" must not be displayed as "React".
                    "target_competency": claim_tech,
                    "matched_requirement": req_comp,
                    # Empty means "no verbatim quote survived the guard"; the UI must
                    # not present a technology name as a resume quotation.
                    "claim_text": best_claim.get("context_narrative") or "",
                    "evidence_source": best_claim.get("source_location") or "CV Skills Section",
                    "score_contribution": round(best_match_score * 100, 2),
                    "confidence": conf,
                    "verified": bool(best_claim.get("has_implementation_detail")),
                })

        # Technologies the CV mentions that no requirement asked for still belong in
        # the dossier (score 0, unverified unless a narrative passed the guard).
        # Without this the graph silently drops everything outside the posting's list.
        for claim in claims:
            tech = (claim.get("technology") or "").strip()
            if not tech or normalize_technology_key(tech) in matched_technologies:
                continue
            matched_technologies.add(normalize_technology_key(tech))
            has_impl = claim.get("has_implementation_detail", False)
            evidence_records.append({
                "dimension": "SKILL",
                "target_competency": tech,
                "matched_requirement": None,
                "claim_text": claim.get("context_narrative") or "",
                "evidence_source": claim.get("source_location") or "CV Skills Section",
                "score_contribution": 0.0,
                "confidence": 0.75 if has_impl else 0.50,
                "verified": bool(has_impl),
            })

        skill_score = (sum(match_scores) / len(core_competencies)) * 100.0
        # match_scores is untouched: collapsing only affects what the dossier displays.
        return round(skill_score, 2), cls._collapse_exact_duplicates(evidence_records)

    @staticmethod
    def _collapse_exact_duplicates(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        One node per technology. The engine emits a row per (technology, requirement)
        pair, so a CV listing only "PostgreSQL" for two database requirements used to
        render as two identical nodes. Requirements are folded into the surviving row's
        `matched_requirement` so coverage is not lost.
        """
        kept: Dict[str, Dict[str, Any]] = {}
        requirements: Dict[str, List[str]] = {}

        for rec in records:
            key = normalize_technology_key(rec.get("target_competency") or "")
            if not key:
                continue

            requirement = rec.get("matched_requirement")
            if requirement:
                bucket = requirements.setdefault(key, [])
                if requirement not in bucket:
                    bucket.append(requirement)

            existing = kept.get(key)
            if existing is None or (rec.get("score_contribution") or 0) > (existing.get("score_contribution") or 0):
                kept[key] = rec

        for key, rec in kept.items():
            joined = ", ".join(requirements.get(key) or [])
            # Column is VARCHAR(100); keep it well inside the limit.
            rec["matched_requirement"] = joined[:100] if joined else None

        return list(kept.values())

    @classmethod
    def calculate_experience_score(
        cls,
        timeline: List[Dict[str, Any]],
        as_of: Optional[datetime] = None,
    ) -> Tuple[float, float]:
        """
        Calculates S_exp based on MergedYears (PRD Bab 5.2):
        - MergedYears < 1.0: 20.0
        - 1.0 <= MergedYears <= 3.0: 20.0 + ((MergedYears - 1.0) / 2.0) * 40.0
        - MergedYears > 3.0: min(100.0, 60.0 + ((MergedYears - 3.0) / 2.0) * 40.0)
        """
        merged_years = merge_employment_intervals(timeline, as_of=as_of)

        if merged_years < 1.0:
            score = 20.0
        elif 1.0 <= merged_years <= 3.0:
            score = 20.0 + ((merged_years - 1.0) / 2.0) * 40.0
        else:
            score = min(100.0, 60.0 + ((merged_years - 3.0) / 2.0) * 40.0)

        return round(score, 2), round(merged_years, 2)

    @classmethod
    def calculate_education_score(
        cls,
        education: Optional[Dict[str, Any]],
        is_programmer_role: bool = True,
    ) -> float:
        """
        Calculates S_edu (Scalar):
        - Tier 1 (20.0): Non-relevant degree or uncompleted
        - Tier 2 (60.0): D3/S1 in IT (jika IT) atau jenjang D3/S1 umum (jika non-IT)
        - Tier 3 (100.0): S2/S3 or high specialization
        """
        if not education:
            return 20.0

        deg = str(education.get("degree", "")).upper()
        field = str(education.get("field_of_study", "")).lower()

        if is_programmer_role:
            is_it_field = any(k in field for k in [
                "informatika", "komputer", "sistem informasi", "software",
                "computer science", "information technology", "teknologi informasi", "rekayasa perangkat lunak"
            ])
            if not is_it_field:
                return 20.0

        if any(re.search(rf"\b{k}\b", deg) for k in ["S2", "S3", "MASTER", "MAGISTER", "PHD"]):
            return 100.0
        if any(re.search(rf"\b{k}\b", deg) for k in ["S1", "D3", "D4", "BACHELOR", "SARJANA", "DIPLOMA"]):
            return 60.0

        return 20.0

    @classmethod
    def calculate_portfolio_score(
        cls,
        verified_repos: Optional[Dict[str, Any]],
        is_programmer_role: bool = True,
        portfolio_url: Optional[str] = None,
    ) -> float:
        """
        Calculates S_port:
        - For programmer roles: max score among verified repos (Tier 3=100, Tier 2=60, Tier 1=20).
        - For non-programmer roles: bypassed without penalty (100.0 if active portfolio, else 70.0).
        """
        if not is_programmer_role:
            return 100.0 if (portfolio_url and portfolio_url.strip()) else 70.0

        if not verified_repos:
            return 0.0

        valid_scores = []
        for repo_url, r in verified_repos.items():
            if not r.get("verified", False):
                valid_scores.append(20.0)
            elif r.get("is_fork", False):
                valid_scores.append(60.0)
            else:
                # Active verified modular repository with commits/stars
                valid_scores.append(100.0)

        return max(valid_scores) if valid_scores else 0.0

    @classmethod
    def evaluate_confidence(cls, claims: List[Dict[str, Any]]) -> str:
        """
        HIGH: >= 80% claims are Tier 2 or Tier 3
        MEDIUM: 50% - 79%
        LOW: < 50%
        """
        if not claims:
            return "LOW"

        tier2_or_3 = sum(1 for c in claims if c.get("has_implementation_detail", False))
        ratio = tier2_or_3 / len(claims)

        if ratio >= 0.8:
            return "HIGH"
        if ratio >= 0.5:
            return "MEDIUM"
        return "LOW"

    @classmethod
    def evaluate_risk(
        cls,
        anomalies: Dict[str, Any],
        timeline: List[Dict[str, Any]],
        as_of: Optional[datetime] = None,
    ) -> Tuple[str, List[str], List[Dict[str, Any]]]:
        """
        Evaluates Unresolved Risk (HIGH, MEDIUM, LOW) & builds anomaly notes.
        - HIGH: Prompt Injection / Hidden text OR full-time concurrent overlap > 3 months.
        - MEDIUM: Title inflation.
        - LOW: Clean.
        - Special: Career break > 12 months generates informative flag, does not force Risk to MEDIUM.

        Returns (risk, flag_codes, details). `flag_codes` stays a plain list of strings
        for backward compatibility; `details` carries the human-readable finding so the
        UI never has to render a raw machine code as its only explanation.
        """
        flags: List[str] = []
        details: List[Dict[str, Any]] = []
        is_high = False
        is_medium = False

        if anomalies.get("prompt_injection_detected") or anomalies.get("hidden_text_detected"):
            is_high = True
            flags.append("SECURITY_QUARANTINE_PROMPT_INJECTION")
            trigger = "teks tersembunyi" if anomalies.get("hidden_text_detected") else "perintah tersembunyi"
            details.append({
                "type": "SECURITY_QUARANTINE_PROMPT_INJECTION",
                "severity": "HIGH",
                "description": (
                    f"Berkas mengandung {trigger} yang mencoba mengarahkan model penilai "
                    "(indikasi prompt injection). Isi CV tidak dapat dipercaya sebelum diaudit manual."
                ),
                "suggested_verification": (
                    "Buka berkas asli dan periksa teks berwarna putih atau berukuran font 0pt. "
                    "Bila terkonfirmasi, eskalasi ke Compliance Officer sebelum berkas dinilai."
                ),
            })

        # Check full-time overlap > 3 months. Roles without a start date cannot be
        # placed on a timeline, so they are skipped rather than defaulted to "now".
        full_time_roles = [
            t for t in timeline
            if isinstance(t, dict)
            and t.get("employment_type", "full_time") == "full_time"
            and str(t.get("start") or "").strip()
            and str(t.get("start") or "").strip().lower() not in ("none", "null")
        ]
        for i in range(len(full_time_roles)):
            for j in range(i + 1, len(full_time_roles)):
                end_i = full_time_roles[i].get("end")
                if end_i is None or str(end_i).strip().lower() in ("none", "null", ""):
                    end_i = "present"
                end_j = full_time_roles[j].get("end")
                if end_j is None or str(end_j).strip().lower() in ("none", "null", ""):
                    end_j = "present"

                r1_start = parse_date_to_months(full_time_roles[i].get("start"), as_of=as_of, end_of_period=False)
                r1_end = parse_date_to_months(end_i, as_of=as_of, end_of_period=True)
                r2_start = parse_date_to_months(full_time_roles[j].get("start"), as_of=as_of, end_of_period=False)
                r2_end = parse_date_to_months(end_j, as_of=as_of, end_of_period=True)

                if r1_start is None or r1_end is None or r2_start is None or r2_end is None:
                    continue

                overlap_start = max(r1_start, r2_start)
                overlap_end = min(r1_end, r2_end)
                # Inclusive month count, matching merge_employment_intervals(): a role
                # spanning 2024-01..2025-12 is 24 months, not 23. Threshold stays
                # "more than 3 months" per PRD.
                overlap_months = overlap_end - overlap_start + 1
                if overlap_months > 3:
                    is_high = True
                    flags.append(f"CONCURRENT_FULLTIME_OVERLAP_{overlap_months}_MONTHS")

                    first, second = full_time_roles[i], full_time_roles[j]
                    details.append({
                        "type": "CONCURRENT_FULLTIME_OVERLAP",
                        "severity": "HIGH",
                        "overlap_months": overlap_months,
                        "period": f"{months_to_label(overlap_start)} s/d {months_to_label(overlap_end)}",
                        "roles": [
                            {
                                "role": first.get("role", "-"),
                                "company": first.get("company", "-"),
                                "start": first.get("start", "-"),
                                "end": first.get("end", "-"),
                            },
                            {
                                "role": second.get("role", "-"),
                                "company": second.get("company", "-"),
                                "start": second.get("start", "-"),
                                "end": second.get("end", "-"),
                            },
                        ],
                        "description": (
                            f"Dua pekerjaan penuh waktu berjalan bersamaan selama {overlap_months} bulan "
                            f"({months_to_label(overlap_start)} s/d {months_to_label(overlap_end)}): "
                            f"\"{first.get('role', '-')}\" di {first.get('company', '-')} "
                            f"({first.get('start', '-')} s/d {first.get('end', '-')}) "
                            f"tumpang tindih dengan \"{second.get('role', '-')}\" di {second.get('company', '-')} "
                            f"({second.get('start', '-')} s/d {second.get('end', '-')})."
                        ),
                        "suggested_verification": (
                            "Konfirmasi ke kandidat apakah salah satu peran sebenarnya paruh waktu, kontrak, "
                            "atau proyek lepas, dan minta penjelasan pembagian jam kerja pada periode tersebut."
                        ),
                    })

        title_inflation_flagged = bool(anomalies.get("title_inflation_detected"))
        if not title_inflation_flagged and len(timeline) >= 2:
            junior_rx = re.compile(r"\b(intern|magang|junior|trainee|fresh graduate)\b", re.IGNORECASE)
            lead_rx = re.compile(r"\b(lead|head|director|chief|vp|principal|architect|cto|ceo)\b", re.IGNORECASE)
            for i, t1 in enumerate(timeline):
                r1_title = str(t1.get("role") or "")
                if not junior_rx.search(r1_title):
                    continue
                s1 = parse_date_to_months(t1.get("start"), as_of=as_of, end_of_period=False)
                if s1 is None:
                    continue
                for j, t2 in enumerate(timeline):
                    if i == j:
                        continue
                    r2_title = str(t2.get("role") or "")
                    if not lead_rx.search(r2_title):
                        continue
                    s2 = parse_date_to_months(t2.get("start"), as_of=as_of, end_of_period=False)
                    if s2 is not None and 0 <= (s2 - s1) < 6:
                        title_inflation_flagged = True
                        break
                if title_inflation_flagged:
                    break

        if title_inflation_flagged:
            is_medium = True
            flags.append("TITLE_INFLATION_DETECTED")
            details.append({
                "type": "TITLE_INFLATION_DETECTED",
                "severity": "MEDIUM",
                "description": (
                    "Kenaikan jabatan terjadi sangat cepat (kurang dari 6 bulan) tanpa jeda yang wajar, "
                    "sehingga perlu dipastikan apakah jabatannya benar-benar berbeda atau hanya perubahan titel."
                ),
                "suggested_verification": (
                    "Minta rincian tanggung jawab pada kedua jabatan dan bandingkan dengan lingkup kerja "
                    "yang wajar untuk level tersebut."
                ),
            })

        career_break_flagged = bool(anomalies.get("career_break_detected"))
        gap_duration = 0
        if not career_break_flagged and len(timeline) >= 2:
            intervals: List[Tuple[int, int]] = []
            for item in timeline:
                if isinstance(item, dict):
                    s = parse_date_to_months(item.get("start"), as_of=as_of, end_of_period=False)
                    e = parse_date_to_months(item.get("end") or "present", as_of=as_of, end_of_period=True)
                    if s is not None and e is not None and e >= s:
                        intervals.append((s, e))
            intervals.sort(key=lambda x: x[0])
            merged: List[Tuple[int, int]] = []
            for start, end in intervals:
                if not merged:
                    merged.append((start, end))
                else:
                    prev_start, prev_end = merged[-1]
                    if start <= prev_end + 1:
                        merged[-1] = (prev_start, max(prev_end, end))
                    else:
                        merged.append((start, end))
            for k in range(len(merged) - 1):
                gap = merged[k + 1][0] - merged[k][1] - 1
                if gap > 12:
                    career_break_flagged = True
                    gap_duration = gap
                    break

        if career_break_flagged:
            flags.append("CAREER_BREAK_FLAG")
            desc_text = (
                f"Terdapat jeda {gap_duration} bulan dalam riwayat kerja. Ini bukan pelanggaran, "
                "hanya perlu konteks agar penilaian pengalaman tidak salah tafsir."
                if gap_duration > 0
                else (
                    "Terdapat jeda lebih dari 12 bulan dalam riwayat kerja. Ini bukan pelanggaran, "
                    "hanya perlu konteks agar penilaian pengalaman tidak salah tafsir."
                )
            )
            details.append({
                "type": "CAREER_BREAK_FLAG",
                "severity": "LOW",
                "description": desc_text,
                "suggested_verification": (
                    "Tanyakan aktivitas selama jeda (studi, cuti keluarga, proyek mandiri) agar durasi "
                    "pengalaman relevan dihitung dengan tepat."
                ),
            })

        if is_high:
            return "HIGH", flags, details
        if is_medium:
            return "MEDIUM", flags, details
        return "LOW", flags, details

    @classmethod
    def evaluate_decision_points(
        cls,
        overall_score: float,
        confidence: str,
        risk: str,
        has_prompt_injection: bool = False,
        cutoff_threshold: float = 85.0,
    ) -> Tuple[str, str, str]:
        """
        Matriks Rekomendasi Hierarkis & Prioritas Triage (PRD Bab 5.2):
        Returns (recommendation, triage_priority, rule_name)
        - Aturan 0: Security Quarantine -> REVIEW_REQUIRED, HIGH_ATTENTION
        - Aturan 1: Overall >= cutoff AND Conf HIGH AND Risk LOW -> STRONG_MATCH, STANDARD
        - Aturan 2: Overall >= 60.0 AND (Risk in {HIGH, MED} OR Conf LOW) -> REVIEW_REQUIRED, HIGH_ATTENTION
        - Aturan 3: Overall >= 60.0 AND Risk LOW AND Conf in {HIGH, MED} -> REVIEW_REQUIRED, STANDARD
        - Aturan 4: Overall < 60.0 -> WEAK_FIT, STANDARD
        """
        if has_prompt_injection:
            return "REVIEW_REQUIRED", "HIGH_ATTENTION", "Aturan 0 (Security Quarantine)"

        if overall_score >= cutoff_threshold and confidence == "HIGH" and risk == "LOW":
            return "STRONG_MATCH", "STANDARD", "Aturan 1 (Kandidat Unggul)"

        if overall_score >= 60.0 and (risk in ("HIGH", "MEDIUM") or confidence == "LOW"):
            return "REVIEW_REQUIRED", "HIGH_ATTENTION", "Aturan 2 (Ambang Kritis / Anomali)"

        if overall_score >= 60.0:
            return "REVIEW_REQUIRED", "STANDARD", "Aturan 3 (Kandidat Kompeten Standard)"

        return "WEAK_FIT", "STANDARD", "Aturan 4 (Eliminasi Kelayakan)"

    @classmethod
    def compute_full_assessment(
        cls,
        claims: List[Dict[str, Any]],
        career_timeline: List[Dict[str, Any]],
        education: Optional[Dict[str, Any]],
        anomalies: Dict[str, Any],
        core_competencies: List[str],
        verified_repos: Optional[Dict[str, Any]] = None,
        weights: Optional[Dict[str, float]] = None,
        is_programmer_role: bool = True,
        portfolio_url: Optional[str] = None,
        competency_taxonomies: Optional[Dict[str, Any]] = None,
        job_title: str = "Posisi",
        as_of: Optional[datetime] = None,
        cutoff_threshold: float = 85.0,
    ) -> Dict[str, Any]:
        """Runs complete deterministic scoring pipeline and returns detailed evaluation bundle."""
        current_time = as_of or datetime.now()
        w = weights or cls.DEFAULT_WEIGHTS
        # Sanitize weights: enforce non-negative numbers and ensure all dimensions are keyed
        cleaned_w = {}
        for dim in cls.DEFAULT_WEIGHTS.keys():
            val = w.get(dim, 0.0 if weights is not None else cls.DEFAULT_WEIGHTS[dim])
            try:
                val_f = float(val)
                cleaned_w[dim] = max(0.0, val_f)
            except (TypeError, ValueError):
                cleaned_w[dim] = 0.0

        total_w = sum(cleaned_w.values())
        if total_w > 0:
            w_norm = {k: v / total_w for k, v in cleaned_w.items()}
        else:
            w_norm = cls.DEFAULT_WEIGHTS

        # 1. Dimension Scores
        skill_score, skill_evidence = cls.calculate_skill_score(
            claims, core_competencies, verified_repos, dynamic_taxonomy=competency_taxonomies
        )
        exp_score, merged_years = cls.calculate_experience_score(career_timeline, as_of=current_time)
        edu_score = cls.calculate_education_score(education, is_programmer_role=is_programmer_role)
        port_score = cls.calculate_portfolio_score(verified_repos, is_programmer_role, portfolio_url)

        # 2. Overall Score (Normalized & Clamped to [0.0, 100.0])
        overall = (
            (skill_score * w_norm.get("SKILL", 0.4))
            + (exp_score * w_norm.get("EXPERIENCE", 0.3))
            + (edu_score * w_norm.get("EDUCATION", 0.1))
            + (port_score * w_norm.get("PORTFOLIO", 0.2))
        )
        overall_score = max(0.0, min(100.0, round(overall, 2)))

        # 3. Confidence & Risk
        confidence = cls.evaluate_confidence(claims)
        risk, anomaly_flags, anomaly_details = cls.evaluate_risk(anomalies, career_timeline, as_of=current_time)

        has_injection = (
            anomalies.get("prompt_injection_detected", False)
            or anomalies.get("hidden_text_detected", False)
        )

        # 4. Decision Points
        recommendation, priority, rule = cls.evaluate_decision_points(
            overall_score=overall_score,
            confidence=confidence,
            risk=risk,
            has_prompt_injection=has_injection,
            cutoff_threshold=cutoff_threshold,
        )

        # 5. Adaptive Assessment Trigger Check (PRD Bab 5.3 Step 5)
        # Generates adaptive challenge if critical gap exists (skill_score < 70 or Risk HIGH)
        needs_adaptive_challenge = (skill_score < 70.0 or risk in ("HIGH", "MEDIUM"))
        adaptive_challenges = []
        if needs_adaptive_challenge and core_competencies:
            # Pick first unmastered or lowest scored requirement
            req_scores: Dict[str, float] = {}
            for ev in skill_evidence:
                req = ev.get("matched_requirement")
                sc = ev.get("score_contribution", 0.0)
                if req:
                    req_scores[req] = max(req_scores.get(req, 0.0), sc)

            unmastered = [c for c in core_competencies if req_scores.get(c, 0.0) < 60.0]
            if not unmastered:
                unmastered = [c for c in core_competencies if req_scores.get(c, 0.0) < 100.0]
            target_skill = unmastered[0] if unmastered else core_competencies[0]

            difficulty = "L2_CASE_STUDY" if risk == "HIGH" else "L1_FUNDAMENTAL"
            if is_programmer_role:
                scenario_q = f"Explain concurrency control, state management, and edge-case error recovery when implementing {target_skill}."
                eval_crit = "Assesses system design depth, race condition prevention, and fault tolerance."
            else:
                scenario_q = f"Jelaskan metodologi dan studi kasus konkret penerapan {target_skill} dalam menyelesaikan kendala operasional pada posisi {job_title}."
                eval_crit = f"Menilai penguasaan terapan {target_skill}, penalaran analisis masalah, dan efektivitas solusi pada peran {job_title}."

            adaptive_challenges.append({
                "target_skill": target_skill,
                "difficulty_level": difficulty,
                "scenario_question": scenario_q,
                "evaluation_criteria": eval_crit,
            })

        return {
            "overall_score": overall_score,
            "dimension_scores": {
                "SKILL": skill_score,
                "EXPERIENCE": exp_score,
                "EDUCATION": edu_score,
                "PORTFOLIO": port_score,
            },
            "confidence_level": confidence,
            "unresolved_risk": risk,
            "recommendation": recommendation,
            "triage_priority": priority,
            "rule_applied": rule,
            "merged_experience_years": merged_years,
            "anomaly_flags": anomaly_flags,
            "anomaly_details": anomaly_details,
            "evidence_records": skill_evidence,
            "adaptive_challenges": adaptive_challenges,
        }
