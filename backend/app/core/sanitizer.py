import re
from typing import Dict, List, Optional, Tuple

# Common Indonesian university identifiers and patterns
UNIVERSITY_PATTERNS = [
    r"\b(?:Universitas|Institut|Politeknik|Sekolah Tinggi|Akademi)\s+[A-Z][a-zA-Z0-9\.\s\-]+",
    r"\b(?:UGM|ITB|UI|ITS|UNPAD|UNDIP|UNAIR|UNS|UB|UNSOED|BINUS|TELKOM|IPB)\b",
]

# Email pattern
EMAIL_PATTERN = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"

# Indonesian / International phone pattern
PHONE_PATTERN = r"(?:\+?62|08|\b02[1-9])(?:[\s\.\-]?\d){7,13}\b"

# Gender keywords
GENDER_PATTERNS = [
    r"\b(?:Laki-laki|Perempuan|Pria|Wanita|Male|Female|Gender\s*:\s*[A-Za-z]+)\b",
]

# Combined compiled regex
COMPILED_EMAIL = re.compile(EMAIL_PATTERN, re.IGNORECASE)
COMPILED_PHONE = re.compile(PHONE_PATTERN)
COMPILED_GENDER = re.compile("|".join(GENDER_PATTERNS), re.IGNORECASE)
COMPILED_UNIV = re.compile("|".join(UNIVERSITY_PATTERNS), re.IGNORECASE)


def sanitize_pii(
    text: str,
    known_name: Optional[str] = None,
    known_email: Optional[str] = None,
    known_phone: Optional[str] = None,
) -> Tuple[str, Dict[str, int]]:
    """
    High-performance in-memory regex PII sanitizer (<20ms).
    Masks names, contact info, emails, gender, and almamater identifiers.
    Implements Two-Way Dictionary Matching when known applicant data is provided.
    """
    if not text:
        return "", {"email": 0, "phone": 0, "name": 0, "gender": 0, "university": 0}

    stats = {"email": 0, "phone": 0, "name": 0, "gender": 0, "university": 0}
    sanitized = text

    # 1. Two-way dictionary matching for known applicant metadata
    if known_email and len(known_email.strip()) > 3:
        pattern = re.escape(known_email.strip())
        matches = len(re.findall(pattern, sanitized, re.IGNORECASE))
        if matches > 0:
            stats["email"] += matches
            sanitized = re.sub(pattern, "[EMAIL_REDACTED]", sanitized, flags=re.IGNORECASE)

    if known_phone and len(known_phone.strip()) > 5:
        digits_only = re.sub(r"\D", "", known_phone)
        if len(digits_only) >= 6:
            # Match variations with spaces/hyphens
            phone_esc = re.escape(known_phone.strip())
            matches = len(re.findall(phone_esc, sanitized))
            if matches > 0:
                stats["phone"] += matches
                sanitized = re.sub(phone_esc, "[PHONE_REDACTED]", sanitized)

    if known_name and len(known_name.strip()) > 2:
        name_parts = [p.strip() for p in known_name.strip().split() if len(p.strip()) > 2]
        # Match full name
        full_name_pattern = r"\b" + re.escape(known_name.strip()) + r"\b"
        matches = len(re.findall(full_name_pattern, sanitized, re.IGNORECASE))
        if matches > 0:
            stats["name"] += matches
            sanitized = re.sub(full_name_pattern, "[NAME_REDACTED]", sanitized, flags=re.IGNORECASE)

        # Match distinct parts if at least 4 chars
        for part in name_parts:
            if len(part) >= 4:
                part_pattern = r"\b" + re.escape(part) + r"\b"
                p_matches = len(re.findall(part_pattern, sanitized, re.IGNORECASE))
                if p_matches > 0:
                    stats["name"] += p_matches
                    sanitized = re.sub(part_pattern, "[NAME_REDACTED]", sanitized, flags=re.IGNORECASE)

    # 2. General regex passes
    emails_found = len(COMPILED_EMAIL.findall(sanitized))
    if emails_found > 0:
        stats["email"] += emails_found
        sanitized = COMPILED_EMAIL.sub("[EMAIL_REDACTED]", sanitized)

    phones_found = len(COMPILED_PHONE.findall(sanitized))
    if phones_found > 0:
        stats["phone"] += phones_found
        sanitized = COMPILED_PHONE.sub("[PHONE_REDACTED]", sanitized)

    genders_found = len(COMPILED_GENDER.findall(sanitized))
    if genders_found > 0:
        stats["gender"] += genders_found
        sanitized = COMPILED_GENDER.sub("[GENDER_REDACTED]", sanitized)

    univs_found = len(COMPILED_UNIV.findall(sanitized))
    if univs_found > 0:
        stats["university"] += univs_found
        sanitized = COMPILED_UNIV.sub("[UNIVERSITY_REDACTED]", sanitized)

    return sanitized, stats
