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


# ponytail: Basic string-match substring guard. Upgrade to fuzzy token alignment if OCR typos occur.
class ClaimItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dimension: Literal["SKILL", "EXPERIENCE", "EDUCATION", "PORTFOLIO"] = "SKILL"
    technology: str = Field(description="Normalized name of technology or competency")
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


class CareerTimelineItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str = Field(description="Job title or role name")
    company: str = Field(description="Company identifier or pseudonymized tag")
    is_relevant_role: bool = Field(
        default=True,
        description="True if role aligns with target job domain",
    )
    employment_type: Literal[
        "full_time", "part_time", "contract", "internship", "freelance"
    ] = "full_time"
    start: str = Field(description="Start date formatted YYYY-MM or YYYY")
    end: str = Field(description="End date formatted YYYY-MM, YYYY, or 'present'")

    @field_validator("employment_type", mode="before")
    @classmethod
    def normalize_employment_type(cls, value):
        """Map unexpected labels to a valid enum instead of failing the whole extraction."""
        if not isinstance(value, str):
            return "full_time"
        key = value.strip().lower()
        if key in VALID_EMPLOYMENT_TYPES:
            return key
        if key in EMPLOYMENT_TYPE_ALIASES:
            return EMPLOYMENT_TYPE_ALIASES[key]
        # Unknown labels ("career_break", "sabbatical") must not become full-time roles:
        # that would invent a concurrent-employment overlap alarm. Park them in the
        # non-full-time bucket so the overlap check ignores them.
        return "contract"


class EducationItem(BaseModel):
    # Strict anti-bias: institution & accreditation strictly forbidden by schema
    model_config = ConfigDict(extra="forbid")

    degree: str = Field(description="Degree level: D3, S1, S2, S3, SMK, etc.")
    field_of_study: str = Field(description="Major/Domain (e.g. Informatika, Sistem Informasi)")
    graduation_status: Literal["Lulus", "Belum Lulus", "Sedang Menempuh"] = "Lulus"


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
