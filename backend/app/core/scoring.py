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
    "go": {"golang", "rust", "c++", "c"},
    "kafka": {"rabbitmq", "sqs", "event-driven", "pubsub"},
    "react": {"vue", "next.js", "frontend", "typescript", "javascript"},
}

METRIC_PATTERN = re.compile(
    r"(?i)(?<![\w.])(?:\d+(?:[.,]\d+)?\s?(?:%|x|ms|sec|detik|rps|qps|tps|req/s|users?|pengguna|k|jt|juta)(?![a-z0-9])|(?:rp|\$)\s?\d[\d.,]*)"
)

CONTEXT_KEYWORDS = {
    "latency", "throughput", "waktu", "biaya", "error", "uptime", "availability",
    "user", "users", "pengguna", "beban", "request", "requests", "query",
    "performa", "akurasi", "memory", "cpu", "rps", "qps", "tps",
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
        severity = (finding or {}).get("severity")
        if severity == "HIGH":
            penalty += 15
        elif severity == "MEDIUM":
            penalty += 8
        else:
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
def calculate_relevance(claimed_tech: str, required_comp: str) -> float:
    """Returns 1.0 for exact match, 0.7 for ecosystem equivalent, 0.0 otherwise."""
    claimed = claimed_tech.strip().lower()
    required = required_comp.strip().lower()

    if claimed == required or required in claimed:
        return 1.0

    equivalents = SKILL_TAXONOMY_MAP.get(required, set())
    if claimed in equivalents:
        return 0.7

    for eq in equivalents:
        if eq in claimed:
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

    has_metric = bool(METRIC_PATTERN.search(combined))
    if not has_metric:
        return False

    has_context_word = any(re.search(rf"\b{re.escape(word)}\b", combined) for word in CONTEXT_KEYWORDS)
    return has_context_word


def parse_date_to_months(date_str: str) -> int:
    """Converts YYYY-MM or YYYY string into absolute month count from Year 0."""
    cleaned = date_str.strip().lower()
    now = datetime.now()
    if cleaned in ("present", "sekarang", "current", "now"):
        return now.year * 12 + now.month

    parts = cleaned.split("-")
    try:
        year = int(parts[0])
        month = int(parts[1]) if len(parts) > 1 else 1
        return year * 12 + month
    except (ValueError, IndexError):
        return now.year * 12 + 1


def normalize_technology_key(name: str) -> str:
    """Identity of a technology name for dedupe: "Next.js" and "nextjs" are one skill."""
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def months_to_label(months: int) -> str:
    """Inverse of parse_date_to_months: absolute month count back to YYYY-MM."""
    year = months // 12
    month = months - year * 12
    if month == 0:
        year -= 1
        month = 12
    return f"{year:04d}-{month:02d}"


def merge_employment_intervals(timeline: List[Dict[str, Any]]) -> float:
    """
    PRD Bab 5.2 Interval Merging:
    Merges overlapping work periods on relevant engineering roles to prevent double-counting.
    Returns aggregated experience in years.
    """
    intervals: List[Tuple[int, int]] = []
    for item in timeline:
        if not item.get("is_relevant_role", True):
            continue

        start_str = str(item.get("start", ""))
        end_str = str(item.get("end", "present"))
        if not start_str:
            continue

        start_m = parse_date_to_months(start_str)
        end_m = parse_date_to_months(end_str)
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
    return max(0.0, total_months / 12.0)


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
    ) -> Tuple[float, List[Dict[str, Any]]]:
        """
        S_comp = (sum(MatchScore_k) / M) * 100
        MatchScore(k) = max(TierScore_i / 100.0 * Relevance_ik)
        """
        if not core_competencies:
            return 100.0, []

        verified_repos = verified_github_repos or {}
        evidence_records: List[Dict[str, Any]] = []
        match_scores: List[float] = []
        matched_technologies: set = set()

        for req_comp in core_competencies:
            best_match_score = 0.0
            best_claim: Optional[Dict[str, Any]] = None
            best_tier = 0.0

            for claim in claims:
                tech = claim.get("technology", "")
                relevance = calculate_relevance(tech, req_comp)
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
                claim_tech = (best_claim.get("technology") or req_comp).strip()
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
    def calculate_experience_score(cls, timeline: List[Dict[str, Any]]) -> Tuple[float, float]:
        """
        Calculates S_exp based on MergedYears (PRD Bab 5.2):
        - MergedYears < 1.0: 20.0
        - 1.0 <= MergedYears <= 3.0: 20.0 + ((MergedYears - 1.0) / 2.0) * 40.0
        - MergedYears > 3.0: min(100.0, 60.0 + ((MergedYears - 3.0) / 2.0) * 40.0)
        """
        merged_years = merge_employment_intervals(timeline)

        if merged_years < 1.0:
            score = 20.0
        elif 1.0 <= merged_years <= 3.0:
            score = 20.0 + ((merged_years - 1.0) / 2.0) * 40.0
        else:
            score = min(100.0, 60.0 + ((merged_years - 3.0) / 2.0) * 40.0)

        return round(score, 2), round(merged_years, 2)

    @classmethod
    def calculate_education_score(cls, education: Optional[Dict[str, Any]]) -> float:
        """
        Calculates S_edu (Scalar):
        - Tier 1 (20.0): Non-relevant degree or uncompleted
        - Tier 2 (60.0): D3/S1 in IT / Computer Science / Informatics
        - Tier 3 (100.0): S2/S3 or high specialization
        """
        if not education:
            return 20.0

        deg = str(education.get("degree", "")).upper()
        field = str(education.get("field_of_study", "")).lower()

        is_it_field = any(k in field for k in [
            "informatika", "komputer", "sistem informasi", "software",
            "computer science", "information technology", "rekayasa perangkat lunak"
        ])

        if not is_it_field:
            return 20.0

        if "S2" in deg or "S3" in deg or "MASTER" in deg or "PHD" in deg:
            return 100.0
        if "S1" in deg or "D3" in deg or "D4" in deg or "BACHELOR" in deg:
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
        - For non-programmer roles: bypassed without penalty (100.0 if active portfolio, else 60.0).
        """
        if not is_programmer_role:
            return 100.0 if portfolio_url else 60.0

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
            if t.get("employment_type", "full_time") == "full_time" and str(t.get("start") or "").strip()
        ]
        for i in range(len(full_time_roles)):
            for j in range(i + 1, len(full_time_roles)):
                r1_start = parse_date_to_months(str(full_time_roles[i].get("start", "")))
                r1_end = parse_date_to_months(str(full_time_roles[i].get("end", "present")))
                r2_start = parse_date_to_months(str(full_time_roles[j].get("start", "")))
                r2_end = parse_date_to_months(str(full_time_roles[j].get("end", "present")))

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

        if anomalies.get("title_inflation_detected"):
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

        if anomalies.get("career_break_detected"):
            flags.append("CAREER_BREAK_FLAG")
            details.append({
                "type": "CAREER_BREAK_FLAG",
                "severity": "LOW",
                "description": (
                    "Terdapat jeda lebih dari 12 bulan dalam riwayat kerja. Ini bukan pelanggaran, "
                    "hanya perlu konteks agar penilaian pengalaman tidak salah tafsir."
                ),
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
    ) -> Dict[str, Any]:
        """Runs complete deterministic scoring pipeline and returns detailed evaluation bundle."""
        w = weights or cls.DEFAULT_WEIGHTS

        # 1. Dimension Scores
        skill_score, skill_evidence = cls.calculate_skill_score(claims, core_competencies, verified_repos)
        exp_score, merged_years = cls.calculate_experience_score(career_timeline)
        edu_score = cls.calculate_education_score(education)
        port_score = cls.calculate_portfolio_score(verified_repos, is_programmer_role, portfolio_url)

        # 2. Overall Score
        overall = (
            (skill_score * w.get("SKILL", 0.4))
            + (exp_score * w.get("EXPERIENCE", 0.3))
            + (edu_score * w.get("EDUCATION", 0.1))
            + (port_score * w.get("PORTFOLIO", 0.2))
        )
        overall_score = round(overall, 2)

        # 3. Confidence & Risk
        confidence = cls.evaluate_confidence(claims)
        risk, anomaly_flags, anomaly_details = cls.evaluate_risk(anomalies, career_timeline)

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
        )

        # 5. Adaptive Assessment Trigger Check (PRD Bab 5.3 Step 5)
        # Generates adaptive challenge if critical gap exists (skill_score < 70 or Risk HIGH)
        needs_adaptive_challenge = (skill_score < 70.0 or risk in ("HIGH", "MEDIUM"))
        adaptive_challenges = []
        if needs_adaptive_challenge and core_competencies:
            # Pick first unmastered skill
            target_skill = core_competencies[0]
            difficulty = "L2_SYSTEM_DESIGN" if risk == "HIGH" else "L1_FUNDAMENTAL"
            adaptive_challenges.append({
                "target_skill": target_skill,
                "difficulty_level": difficulty,
                "scenario_question": f"Explain concurrency control and transaction rollback strategy when designing services with {target_skill}.",
                "evaluation_criteria": "Assesses technical depth, handling of race conditions, and error recovery.",
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
