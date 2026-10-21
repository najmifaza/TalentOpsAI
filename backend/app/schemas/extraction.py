import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_EMPLOYMENT_TYPES = {"full_time", "part_time", "contract", "internship", "freelance"}

# The model occasionally emits labels like "career_break" or "full-time". A single
# unexpected token used to fail the whole CandidateExtractionSchema and silently drop
# the candidate to heuristic fallback, so unknown values are normalized instead.
EMPLOYMENT_TYPE_ALIASES = {
    "full-time": "full_time",
    "fulltime": "full_time",
    "full time": "full_time",
    "permanent": "full_time",
    "tetap": "full_time",
    "part-time": "part_time",
    "parttime": "part_time",
    "part time": "part_time",
    "magang": "internship",
    "intern": "internship",
    "kontrak": "contract",
    "lepas": "freelance",
    "freelancer": "freelance",
}

VALID_DIMENSIONS = {"SKILL", "EXPERIENCE", "EDUCATION", "PORTFOLIO"}
DIMENSION_ALIASES = {
    "KEAHLIAN": "SKILL",
    "PENGALAMAN": "EXPERIENCE",
    "PENDIDIKAN": "EDUCATION",
    "PORTOFOLIO": "PORTFOLIO",
}

VALID_GRADUATION_STATUSES = {"Lulus", "Belum Lulus", "Sedang Menempuh"}
# Every one of these is a real label the model has produced for a CV that states
# "Sedang Menempuh Pendidikan". Substring matching below catches the rest.
GRADUATION_STATUS_ALIASES = {
    "lulus": "Lulus",
    "graduated": "Lulus",
    "selesai": "Lulus",
    "belum lulus": "Belum Lulus",
    "belum selesai": "Belum Lulus",
    "not graduated": "Belum Lulus",
    "sedang menempuh": "Sedang Menempuh",
    "sedang menempuh pendidikan": "Sedang Menempuh",
    "masih menempuh": "Sedang Menempuh",
    "on going": "Sedang Menempuh",
    "ongoing": "Sedang Menempuh",
    "in progress": "Sedang Menempuh",
}


def _match_enum(value: object, valid: set, aliases: dict, fallback: str) -> str:
    """
    Resolve a model-emitted label against a strict enum without failing validation.
    Exact match first, then alias table, then a containment pass ("Sedang Menempuh
    Pendidikan" contains "sedang menempuh"). Unknown labels take the fallback rather
    than discarding the candidate's whole extraction.
    """
    if not isinstance(value, str):
        return fallback
    key = " ".join(value.strip().lower().split())
    if not key:
        return fallback
    for candidate in valid:
        if key == candidate.lower():
            return candidate
    if key in aliases:
        return aliases[key]
    # Longest alias first so "belum lulus" wins over "lulus".
    for alias in sorted(aliases, key=len, reverse=True):
        if alias in key:
            return aliases[alias]
    return fallback


# ponytail: Basic string-match substring guard. Upgrade to fuzzy token alignment if OCR typos occur.
class ClaimItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dimension: Literal["SKILL", "EXPERIENCE", "EDUCATION", "PORTFOLIO"] = "SKILL"
    technology: str = Field(default="-", description="Normalized name of technology or competency")
    has_implementation_detail: bool = Field(
        default=False,
        description="True if narrative contains real implementation action and context",
    )
    context_narrative: str | None = Field(
        default=None,
        description="Verbatim narrative snippet from resume demonstrating usage",
    )
    metric_string: str | None = Field(
        default=None,
        description="Measured outcome or performance metric string",
    )
    repo_url: str | None = Field(
        default=None,
        description="Public GitHub repository URL validating claim",
    )
    source_location: str | None = Field(
        default=None,
        description="Page or section where claim is cited in CV",
    )

    @field_validator("dimension", mode="before")
    @classmethod
    def normalize_dimension(cls, value):
        return _match_enum(value, VALID_DIMENSIONS, DIMENSION_ALIASES, "SKILL")

    @field_validator("technology", mode="before")
    @classmethod
    def coerce_technology(cls, value):
        """A claim with no technology name is useless but must not sink the extraction."""
        if value is None:
            return "-"
        if not isinstance(value, str):
            return str(value)
        return value.strip() or "-"


class CareerTimelineItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str = Field(default="-", description="Job title or role name")
    company: str = Field(default="-", description="Company identifier or pseudonymized tag")
    is_relevant_role: bool = Field(
        default=True,
        description="True if role aligns with target job domain",
    )
    employment_type: Literal[
        "full_time", "part_time", "contract", "internship", "freelance"
    ] = "full_time"
    start: str = Field(default="", description="Start date formatted YYYY-MM or YYYY")
    end: str = Field(default="", description="End date formatted YYYY-MM, YYYY, or 'present'")

    @field_validator("role", "company", "start", "end", mode="before")
    @classmethod
    def coerce_missing_text(cls, value):
        """
        The model emits null for fields a career-gap entry has no answer for
        (company: null). A single null used to fail the whole CandidateExtractionSchema
        and silently drop the candidate to heuristic fallback.
        """
        if value is None:
            return ""
        if not isinstance(value, str):
            return str(value)
        return value.strip()

    @field_validator("role", "company")
    @classmethod
    def label_blank_as_dash(cls, value):
        """Blank after coercion reads as a missing value in the UI, not an empty card."""
        return value or "-"

    @field_validator("employment_type", mode="before")
    @classmethod
    def normalize_employment_type(cls, value):
        """Map unexpected labels to a valid enum instead of failing the whole extraction."""
        # Unknown labels ("career_break", "sabbatical") must not become full-time roles:
        # that would invent a concurrent-employment overlap alarm. "contract" is the
        # non-full-time bucket, so the overlap check ignores them.
        return _match_enum(value, VALID_EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_ALIASES, "contract")


class EducationItem(BaseModel):
    # Strict anti-bias: institution & accreditation strictly forbidden by schema
    model_config = ConfigDict(extra="forbid")

    degree: str = Field(default="-", description="Degree level: D3, S1, S2, S3, SMK, etc.")
    field_of_study: str = Field(default="-", description="Major/Domain (e.g. Informatika, Sistem Informasi)")
    graduation_status: Literal["Lulus", "Belum Lulus", "Sedang Menempuh"] = "Lulus"

    @field_validator("degree", "field_of_study", mode="before")
    @classmethod
    def coerce_missing_text(cls, value):
        if value is None:
            return "-"
        if not isinstance(value, str):
            return str(value)
        return value.strip() or "-"

    @field_validator("graduation_status", mode="before")
    @classmethod
    def normalize_graduation_status(cls, value):
        """
        The model answers "Sedang Menempuh Pendidikan" for an in-progress degree.
        That literal used to fail the whole CandidateExtractionSchema, dropping the
        candidate to heuristic fallback with zero evidence.
        """
        return _match_enum(
            value, VALID_GRADUATION_STATUSES, GRADUATION_STATUS_ALIASES, "Lulus"
        )


class AnomalyFlags(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hidden_text_detected: bool = False
    prompt_injection_detected: bool = False
    career_break_detected: bool = False
    overlapping_dates_detected: bool = False
    title_inflation_detected: bool = False
    notes: list[str] = Field(default_factory=list)


class CandidateExtractionSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    github_url: str | None = Field(default=None, description="Candidate GitHub profile or primary repository URL")
    portfolio_url: str | None = Field(default=None, description="Candidate personal portfolio website URL")
    claims: list[ClaimItem] = Field(default_factory=list)
    career_timeline: list[CareerTimelineItem] = Field(default_factory=list)
    education: EducationItem | None = None
    anomalies: AnomalyFlags = Field(default_factory=AnomalyFlags)

    def apply_substring_guard(self, sanitized_cv_text: str) -> None:
        """
        PRD Bab 5.1 Substring Guard:
        Validates claim narrative & metric against sanitized CV text using whitespace
        collapsing and lowercase. If not found, downgrade has_implementation_detail to False
        AND drop the unverified text, so a paraphrase can never be rendered later as a
        verbatim resume quotation.
        """
        normalized_cv = " ".join(sanitized_cv_text.lower().split())

        for claim in self.claims:
            if not claim.has_implementation_detail:
                continue

            narrative = (claim.context_narrative or "").strip().lower()
            norm_narrative = " ".join(narrative.split())

            if norm_narrative and norm_narrative not in normalized_cv:
                claim.has_implementation_detail = False
                claim.context_narrative = None
                claim.metric_string = None
                if self.anomalies:
                    self.anomalies.notes.append(
                        f"Substring guard downgraded claim for '{claim.technology}': narrative not verified in CV text."
                    )
