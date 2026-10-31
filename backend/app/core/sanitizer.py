"""
In-memory PII sanitizer for resume text (PRD Bab 6.4, target latency < 20 ms).

Two operating modes, matching the two ingestion paths:

1. **Form-backed** (`/careers/{id}/apply`) — the applicant supplies name, email and
   phone, so we have an explicit dictionary. Two-way dictionary matching is exact
   and high-recall.

2. **Header-inferred** (`/candidates/upload`, the HR dropzone) — no metadata at all.
   The PRD (Bab 6.4) is explicit that this path must lean on rule-based heuristics
   plus the top contact block, and that false negatives on non-standard Indonesian
   names in free narrative must be *recorded honestly* rather than papered over.

The second mode is where naive regex sanitizers leak: they redact the email and
phone but leave the person's actual name standing in the first line of the document.

Design rules enforced here:
  - Unicode is normalised (NFKC) and zero-width characters are stripped before
    matching, so `budi@exa\\u200bmple.com` cannot bypass the email pattern.
  - Name inference only ever *adds* redaction. If inference fails, the residual
    audit reports it instead of silently passing.
  - Over-redaction is preferred to leakage for identity fields, but dates and
    durations are left alone: they are legitimate timeline signal, not PII.
  - Redaction markers are idempotent — re-running the sanitizer is a no-op.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REDACTED = {
    "email": "[EMAIL_REDACTED]",
    "phone": "[PHONE_REDACTED]",
    "name": "[NAME_REDACTED]",
    "gender": "[GENDER_REDACTED]",
    "university": "[UNIVERSITY_REDACTED]",
    "nik": "[NIK_REDACTED]",
    "npwp": "[NPWP_REDACTED]",
    "address": "[ADDRESS_REDACTED]",
    "dob": "[DOB_REDACTED]",
    "marital": "[MARITAL_REDACTED]",
    "religion": "[RELIGION_REDACTED]",
    "social_url": "[URL_REDACTED]",
    "student_id": "[STUDENT_ID_REDACTED]",
    "passport": "[PASSPORT_REDACTED]",
    "age": "[AGE_REDACTED]",
}

# Zero-width and other invisible characters used to break naive regex matching.
_INVISIBLE = dict.fromkeys(
    map(ord, "\u200b\u200c\u200d\u2060\ufeff\u00ad\u180e\u200e\u200f"), None
)

# Headings that must never be mistaken for a person's name.
_NON_NAME_LINES = {
    "curriculum vitae", "daftar riwayat hidup", "resume", "riwayat hidup",
    "personal details", "data pribadi", "profil", "profile", "summary",
    "ringkasan", "objective", "tujuan", "pendidikan", "education",
    "pengalaman kerja", "work experience", "experience", "pengalaman",
    "keahlian", "skills", "kemampuan", "proyek", "projects", "project",
    "sertifikasi", "certifications", "organisasi", "organization",
    "penghargaan", "awards", "referensi", "references", "kontak", "contact",
    "informasi pribadi", "biodata", "halaman", "page",
}

# Academic/professional titles stripped before a name is used for matching.
_TITLES = {
    "ir", "dr", "drs", "dra", "prof", "h", "hj", "kh", "ph.d", "phd",
    "s.kom", "s.t", "s.ti", "m.t", "m.kom", "s.si", "m.si", "s.e", "m.m",
    "s.pd", "s.h", "m.h", "s.ked", "s.farm", "a.md", "amd", "s.sos",
    "s.ip", "s.ab", "m.b.a", "mba", "s.ds", "m.ds", "s.ikom",
}

_MONTHS = (
    "januari|februari|maret|april|mei|juni|juli|agustus|september|"
    "oktober|november|desember|january|february|march|april|may|june|july|"
    "august|september|october|november|december|jan|feb|mar|apr|jun|jul|"
    "aug|sep|sept|oct|nov|dec"
)

# ---------------------------------------------------------------------------
# Compiled patterns
# ---------------------------------------------------------------------------

# Email: standard, plus bracket-obfuscated forms ("budi [at] gmail [dot] com").
_RE_EMAIL = re.compile(
    r"[A-Za-z0-9_.+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+",
    re.IGNORECASE,
)
_RE_EMAIL_OBFUSCATED = re.compile(
    r"\b[A-Za-z0-9_.+\-]+\s*(?:\[at\]|\(at\)|\{at\})\s*"
    r"[A-Za-z0-9\-]+(?:\s*(?:\[dot\]|\(dot\)|\{dot\}|\.)\s*[A-Za-z0-9\-]+)+",
    re.IGNORECASE,
)

# Phone: Indonesian and international, tolerant of separators.
# Separators are `[ \t.\-]`, never `\s`: a newline is a field boundary, and
# letting `\s` match it swallows the line break and glues the next field on.
_RE_PHONE = re.compile(
    r"(?:\+?62|0)8[ \t.\-]?(?:\d[ \t.\-]?){7,12}\b"
    r"|(?:\+?62|0)[2-9]\d{1,2}[ \t.\-]?(?:\d[ \t.\-]?){5,11}\b"
    r"|\+\d{1,3}[ \t.\-]?\d{2,4}[ \t.\-]?\d{3,4}[ \t.\-]?\d{3,4}\b"
)

# Indonesian national ID: 16 digits, province prefix 11-99 (never starts with 0).
# Layout is 2 (province) + 4 + 4 + 4 + 2 = 16.
_RE_NIK = re.compile(
    r"\b(?:1[1-9]|[2-9]\d)[ \t.\-]?\d{4}[ \t.\-]?\d{4}[ \t.\-]?\d{4}[ \t.\-]?\d{2}\b"
)

# Tax ID: 15 digits, optionally dotted as 00.000.000.0-000.000.
_RE_NPWP = re.compile(
    r"\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b"
    r"|\b(?:0[1-9]|[1-9]\d)\d{13}\b"
)

# Postal address lines (whole line is redacted).
_RE_ADDRESS_LINE = re.compile(
    r"^[^\n]*\b(?:Jl\.?|Jalan|Gang|Gg\.|Perum|Perumahan|Komplek|Kompleks|"
    r"Blok|RT\.?\s*\d|RW\.?\s*\d|Kel\.|Kelurahan|Kec\.|Kecamatan|"
    r"Kab\.|Kabupaten|Kode\s*Pos|Kodepos)\b[^\n]*$",
    re.IGNORECASE | re.MULTILINE,
)

# Date of birth — only when anchored to a birth keyword. A bare date is a
# legitimate employment/education timeline and must not be redacted.
_RE_DOB = re.compile(
    r"\b(?:tempat\s*,?\s*)?(?:tanggal\s+lahir|tgl\.?\s*lahir|lahir|ttl|"
    r"date\s+of\s+birth|dob|born)\b\s*[:：\-]?\s*[^\n]*"
    r"|\b(?:tempat\s*,?\s*)?(?:tanggal\s+lahir|tgl\.?\s*lahir|lahir|ttl)\b"
    r"[^\n]*?\b\d{1,2}[\s\-/]+(?:" + _MONTHS + r")[\s\-/]+\d{4}\b[^\n]*",
    re.IGNORECASE,
)

# Marital status and religion — both are discriminatory attributes under
# fair-hiring policy, so the value is removed wherever it is labelled.
_RE_MARITAL = re.compile(
    r"\b(?:status\s*(?:perkawinan|pernikahan|marital)?|marital\s*status|"
    r"status\s*nikah)\b\s*[:：]\s*[^\n,;]+"
    r"|\b(?:belum\s+menikah|sudah\s+menikah|menikah|kawin|cerai(?:\s+hidup|\s+mati)?|"
    r"single|married|divorced|widowed)\b",
    re.IGNORECASE,
)
_RE_RELIGION = re.compile(
    r"\b(?:agama|religion|kepercayaan)\b\s*[:：]\s*[^\n,;]+"
    r"|\b(?:islam|kristen|katolik|hindu|buddha|budha|protestan|konghucu)\b",
    re.IGNORECASE,
)

# Social/professional profile URLs. Redacted in the narrative because the same
# handle is stored separately (and verified) via `github_url`.
_RE_SOCIAL_URL = re.compile(
    r"(?:https?://)?(?:www\.)?"
    r"(?:linkedin\.com|github\.com|gitlab\.com|bitbucket\.org|behance\.net|"
    r"dribbble\.com|kaggle\.com|medium\.com|instagram\.com|facebook\.com|"
    r"twitter\.com|x\.com)/[^\s,;)\]}\"']+",
    re.IGNORECASE,
)

# Student/employee identifiers.
_RE_STUDENT_ID = re.compile(
    r"\b(?:NIM|NIP|NIDN|NRP|NIK\s*Karyawan|Employee\s*ID)\b[\s.:：]*[A-Z0-9][A-Z0-9.\-/]{5,}",
    re.IGNORECASE,
)

# Passport number.
_RE_PASSPORT = re.compile(
    r"\b(?:no\.?\s*)?(?:paspor|passport)\b[\s.:：]*[A-Z]{1,2}\s?\d{6,8}\b",
    re.IGNORECASE,
)

# Age — requires an explicit label, so "3 tahun pengalaman" survives.
_RE_AGE = re.compile(
    r"\b(?:usia|umur|age)\b\s*[:：]?\s*\d{1,2}\s*(?:tahun|thn|years?\s*old|y/o)?",
    re.IGNORECASE,
)

# Gender keywords. The labelled form accepts hyphens so "Laki-laki" is consumed
# whole instead of leaving a dangling "-laki" fragment behind.
_RE_GENDER = re.compile(
    r"\b(?:laki-laki|perempuan|pria|wanita|male|female)\b"
    r"|\b(?:jenis\s*kelamin|gender)\b\s*[:：]\s*[A-Za-z\-]+",
    re.IGNORECASE,
)

# Universities: capped at four words so the match cannot swallow a whole line.
_RE_UNIVERSITY = re.compile(
    r"\b(?:Universitas|Institut|Politeknik|Sekolah\s+Tinggi|Akademi|"
    r"University|College)\b(?:\s+[A-Z][A-Za-z0-9.\-]*){0,4}"
    r"|\b(?:UGM|ITB|UI|ITS|UNPAD|UNDIP|UNAIR|UNS|UB|UNSOED|BINUS|TELKOM|"
    r"IPB|UNY|UNNES|UIN|UPN|UNHAS|UNAND|UNPAD)\b",
    re.IGNORECASE,
)

# Labelled name fields, used for header inference.
_RE_LABELLED_NAME = re.compile(
    r"\b(?:nama(?:\s+lengkap)?|name|full\s*name)\b\s*[:：]\s*([^\n,;|]{3,60})",
    re.IGNORECASE,
)

# A name-like token sequence: 2-5 capitalised words, letters only.
_RE_NAME_LIKE = re.compile(r"^[A-Z][A-Za-z'’.\-]*(?:\s+[A-Z][A-Za-z'’.\-]*){1,4}$")

# Capitalised runs inside free narrative, used by the residual audit.
_RE_CAPITALISED_RUN = re.compile(r"\b[A-Z][a-z'’]{2,}(?:\s+[A-Z][a-z'’]{2,}){1,3}\b")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalise_text(text: str) -> str:
    """
    Applies NFKC and strips invisible characters.

    NFKC folds full-width `＠` to `@` and compatibility forms to their canonical
    equivalent, so obfuscation tricks do not survive to the regex stage.
    """
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    return text.translate(_INVISIBLE)


def _strip_titles(candidate: str) -> str:
    """Removes leading/trailing academic titles so the bare name can be matched."""
    tokens = re.split(r"[\s,]+", candidate.strip())
    kept = [t for t in tokens if t and t.lower().strip(".,") not in _TITLES]
    return " ".join(kept).strip(" ,.")


def _is_name_like(line: str) -> bool:
    """Heuristic: does this line look like a standalone person name?"""
    stripped = line.strip().strip(",;|")
    if not (3 <= len(stripped) <= 60):
        return False
    if any(ch.isdigit() for ch in stripped):
        return False
    if "@" in stripped or "http" in stripped.lower():
        return False
    if stripped.lower().strip(":：") in _NON_NAME_LINES:
        return False
    if any(w in stripped.lower() for w in ("universitas", "jalan", "jl.", "kecamatan")):
        return False
    return bool(_RE_NAME_LIKE.match(stripped))


def infer_name_from_header(text: str, max_lines: int = 8) -> Optional[str]:
    """
    Infers the applicant's name from the document header when no form data exists.

    Tries, in order:
      1. an explicit `Nama:` / `Name:` label anywhere in the header block
      2. a standalone name-like line within the first `max_lines` lines

    Returns `None` rather than guessing when nothing looks like a name.
    """
    if not text:
        return None

    header = "\n".join(text.splitlines()[:max_lines])

    labelled = _RE_LABELLED_NAME.search(header)
    if labelled:
        name = _strip_titles(labelled.group(1))
        if name and _is_name_like(name):
            return name

    for line in text.splitlines()[:max_lines]:
        cleaned = _strip_titles(line)
        if _is_name_like(cleaned):
            return cleaned

    return None


def _redact(
    text: str,
    pattern: re.Pattern,
    marker: str,
    stats: Dict[str, int],
    key: str,
) -> str:
    """Substitutes all matches, accumulating the count under `key`."""
    found = len(pattern.findall(text))
    if not found:
        return text
    stats[key] = stats.get(key, 0) + found
    return pattern.sub(marker, text)


def _dictionary_redact(
    text: str,
    value: str,
    marker: str,
    stats: Dict[str, int],
    key: str,
    min_len: int = 3,
) -> str:
    """Redacts one known value and, for names, each distinctive part."""
    value = value.strip()
    if len(value) < min_len:
        return text

    pattern = r"\b" + re.escape(value) + r"\b"
    found = len(re.findall(pattern, text, re.IGNORECASE))
    if found:
        stats[key] = stats.get(key, 0) + found
        text = re.sub(pattern, marker, text, flags=re.IGNORECASE)

    return text


def _redact_name_variants(
    text: str, name: str, stats: Dict[str, int]
) -> str:
    """
    Redacts a name in the forms that actually appear in resumes: full, reversed
    (`Santoso, Budi`), and per distinctive part (>= 4 chars to avoid shredding
    unrelated words).
    """
    name = _strip_titles(name)
    if not name:
        return text

    text = _dictionary_redact(text, name, REDACTED["name"], stats, "name", min_len=3)

    parts = [p for p in re.split(r"\s+", name) if p]
    if len(parts) >= 2:
        reversed_name = f"{parts[-1]}, {' '.join(parts[:-1])}"
        text = _dictionary_redact(
            text, reversed_name, REDACTED["name"], stats, "name", min_len=5
        )

    for part in parts:
        if len(part) >= 4:
            text = _dictionary_redact(
                text, part, REDACTED["name"], stats, "name", min_len=4
            )

    return text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@dataclass
class SanitizationResult:
    """Full sanitization outcome, including an honest false-negative report."""

    text: str
    stats: Dict[str, int] = field(default_factory=dict)
    detected_name: Optional[str] = None
    name_source: str = "none"
    residual_name_candidates: List[str] = field(default_factory=list)
    limitations: List[str] = field(default_factory=list)

    @property
    def total_redactions(self) -> int:
        return sum(self.stats.values())

    @property
    def has_residual_risk(self) -> bool:
        return bool(self.residual_name_candidates)


def sanitize_pii(
    text: str,
    known_name: Optional[str] = None,
    known_email: Optional[str] = None,
    known_phone: Optional[str] = None,
) -> Tuple[str, Dict[str, int]]:
    """
    Backward-compatible entry point: returns `(sanitized_text, stats)`.

    Prefer `sanitize_resume()` when the caller wants the residual-risk report.
    """
    result = sanitize_resume(
        text,
        known_name=known_name,
        known_email=known_email,
        known_phone=known_phone,
    )
    return result.text, result.stats


def sanitize_resume(
    text: str,
    known_name: Optional[str] = None,
    known_email: Optional[str] = None,
    known_phone: Optional[str] = None,
) -> SanitizationResult:
    """
    Sanitizes resume text and reports what could not be confidently removed.

    When `known_name` is absent the name is inferred from the document header, so
    the HR dropzone path (no form metadata) still redacts the applicant's identity
    rather than only their contact details.
    """
    stats: Dict[str, int] = {k: 0 for k in REDACTED}

    if not text or not text.strip():
        return SanitizationResult(text="", stats=stats)

    sanitized = normalise_text(text)
    limitations: List[str] = []

    # 1. Resolve the name: explicit form data wins, header inference is the fallback.
    name_source = "none"
    resolved_name = (known_name or "").strip() or None
    if resolved_name:
        name_source = "form"
    else:
        inferred = infer_name_from_header(sanitized)
        if inferred:
            resolved_name = inferred
            name_source = "header_inference"

    # 2. Structural identifiers before free-text patterns, so a 16-digit NIK is
    #    not partially consumed by the phone or NPWP pattern.
    sanitized = _redact(sanitized, _RE_NIK, REDACTED["nik"], stats, "nik")
    sanitized = _redact(sanitized, _RE_NPWP, REDACTED["npwp"], stats, "npwp")
    sanitized = _redact(sanitized, _RE_PASSPORT, REDACTED["passport"], stats, "passport")
    sanitized = _redact(sanitized, _RE_STUDENT_ID, REDACTED["student_id"], stats, "student_id")

    # 3. Contact details, including obfuscated spellings.
    sanitized = _redact(sanitized, _RE_EMAIL, REDACTED["email"], stats, "email")
    sanitized = _redact(sanitized, _RE_EMAIL_OBFUSCATED, REDACTED["email"], stats, "email")
    sanitized = _redact(sanitized, _RE_PHONE, REDACTED["phone"], stats, "phone")
    sanitized = _redact(sanitized, _RE_SOCIAL_URL, REDACTED["social_url"], stats, "social_url")

    # 4. Protected attributes and demographics.
    sanitized = _redact(sanitized, _RE_ADDRESS_LINE, REDACTED["address"], stats, "address")
    sanitized = _redact(sanitized, _RE_DOB, REDACTED["dob"], stats, "dob")
    sanitized = _redact(sanitized, _RE_MARITAL, REDACTED["marital"], stats, "marital")
    sanitized = _redact(sanitized, _RE_RELIGION, REDACTED["religion"], stats, "religion")
    sanitized = _redact(sanitized, _RE_AGE, REDACTED["age"], stats, "age")
    sanitized = _redact(sanitized, _RE_GENDER, REDACTED["gender"], stats, "gender")
    sanitized = _redact(sanitized, _RE_UNIVERSITY, REDACTED["university"], stats, "university")

    # 5. Identity dictionary LAST, and only after emails/URLs are gone.
    #    Running it earlier shreds `budi.santoso@gmail.com` into
    #    `[NAME_REDACTED].[NAME_REDACTED]@gmail.com`, which leaves the mail domain
    #    behind and breaks the email pattern that would have removed it entirely.
    if known_email:
        sanitized = _dictionary_redact(
            sanitized, known_email, REDACTED["email"], stats, "email", min_len=5
        )
    if known_phone:
        sanitized = _dictionary_redact(
            sanitized, known_phone, REDACTED["phone"], stats, "phone", min_len=6
        )
    if resolved_name:
        sanitized = _redact_name_variants(sanitized, resolved_name, stats)

    # 6. Honest residual audit: report name-like sequences that survived, rather
    #    than claiming a clean result we cannot substantiate.
    residual: List[str] = []
    if resolved_name is None:
        limitations.append(
            "NAME_NOT_RESOLVED: no form name and no name-like header line was found; "
            "names appearing only in free narrative cannot be identified reliably."
        )
        seen = set()
        for match in _RE_CAPITALISED_RUN.finditer(sanitized):
            token = match.group(0)
            if token.lower() in _NON_NAME_LINES or token in seen:
                continue
            seen.add(token)
            residual.append(token)
        residual = residual[:10]
        if residual:
            limitations.append(
                f"UNVERIFIED_NAME_CANDIDATES: {len(residual)} capitalised sequence(s) "
                "survived sanitization and may include applicant names."
            )

    if name_source == "header_inference":
        limitations.append(
            "NAME_FROM_HEADER_INFERENCE: the name was inferred heuristically from the "
            "document header; non-standard layouts may yield a wrong or partial name."
        )

    return SanitizationResult(
        text=sanitized,
        stats=stats,
        detected_name=resolved_name,
        name_source=name_source,
        residual_name_candidates=residual,
        limitations=limitations,
    )
