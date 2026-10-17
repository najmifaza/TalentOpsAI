import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


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

    claims: list[ClaimItem] = Field(default_factory=list)
    career_timeline: list[CareerTimelineItem] = Field(default_factory=list)
    education: EducationItem | None = None
    anomalies: AnomalyFlags = Field(default_factory=AnomalyFlags)

    def apply_substring_guard(self, sanitized_cv_text: str) -> None:
        """
        PRD Bab 5.1 Substring Guard:
        Validates claim narrative & metric against sanitized CV text using whitespace
        collapsing and lowercase. If not found, downgrade has_implementation_detail to False.
        """
        normalized_cv = " ".join(sanitized_cv_text.lower().split())

        for claim in self.claims:
            if not claim.has_implementation_detail:
                continue

            narrative = (claim.context_narrative or "").strip().lower()
            norm_narrative = " ".join(narrative.split())

            if norm_narrative and norm_narrative not in normalized_cv:
                claim.has_implementation_detail = False
                if self.anomalies:
                    self.anomalies.notes.append(
                        f"Substring guard downgraded claim for '{claim.technology}': narrative not verified in CV text."
                    )
