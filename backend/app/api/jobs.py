import json
import logging
import re
from datetime import date
from typing import Any, ClassVar, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import require_roles
from app.core.scoring import DeterministicScoringEngine, inclusivity_from_findings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["Job Intelligence & Policy Simulation"])


class WeightConfigSchema(BaseModel):
    SKILL: float = Field(default=0.4, ge=0.0, le=1.0, description="Bobot dimensi Core Competencies Coverage")
    EXPERIENCE: float = Field(default=0.3, ge=0.0, le=1.0, description="Bobot dimensi Kronologi Pengalaman Kerja")
    EDUCATION: float = Field(default=0.1, ge=0.0, le=1.0, description="Bobot dimensi Linieritas Jenjang Pendidikan")
    PORTFOLIO: float = Field(default=0.2, ge=0.0, le=1.0, description="Bobot dimensi Portofolio Repositori GitHub")

    @model_validator(mode="after")
    def validate_sum_equals_one(self) -> "WeightConfigSchema":
        total = self.SKILL + self.EXPERIENCE + self.EDUCATION + self.PORTFOLIO
        # Allow minor floating point rounding deviation
        if not (0.99 <= total <= 1.01):
            raise ValueError(f"Total bobot 4D harus sama dengan 1.0 (didapat: {total:.3f})")
        return self


class PolicySimulationRequest(BaseModel):
    weights: WeightConfigSchema = Field(default_factory=WeightConfigSchema)
    min_overall_score: float = Field(
        default=75.0,
        ge=0.0,
        le=100.0,
        description="Ambang batas dinamis STRONG_MATCH (default 75.0 menggantikan cut-off 85.0 PRD Bab 8.2)",
    )


class JobProfileFields(BaseModel):
    """Profil publik lowongan. Semua opsional: baris lama tidak punya isinya."""

    company_name: Optional[str] = Field(None, max_length=150)
    company_logo_url: Optional[str] = Field(None, max_length=255)
    company_about: Optional[str] = None
    company_address: Optional[str] = Field(None, max_length=255)
    company_industry: Optional[str] = Field(None, max_length=100)
    company_website: Optional[str] = Field(None, max_length=255)
    job_function: Optional[str] = Field(None, max_length=100)
    employment_level: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=150)
    deadline: Optional[date] = None
    description_text: Optional[str] = None
    requirements_text: Optional[str] = None

    # Nama kolom DB. Dipakai sebagai allowlist supaya tidak ada field asing yang
    # bocor ke INSERT/UPDATE, dan supaya subclass tidak menambah kolom diam-diam.
    PROFILE_FIELDS: ClassVar[tuple] = (
        "company_name", "company_logo_url", "company_about", "company_address",
        "company_industry", "company_website", "job_function", "employment_level",
        "location", "deadline", "description_text", "requirements_text",
    )

    def as_params(self) -> Dict[str, Any]:
        data = self.model_dump()
        if data.get("deadline") is not None:
            data["deadline"] = data["deadline"].isoformat()
        return {field: data[field] for field in self.PROFILE_FIELDS}


class CreateJobRequest(JobProfileFields):
    title: str = Field(..., min_length=3, max_length=150, description="Judul posisi lowongan")
    department: str = Field(..., min_length=2, max_length=100, description="Departemen / Divisi")
    raw_text: str = Field(..., min_length=10, description="Deskripsi lengkap lowongan")
    core_competencies: List[str] = Field(default_factory=list, description="Daftar kompetensi kunci")
    weight_config: WeightConfigSchema = Field(default_factory=WeightConfigSchema, description="Konfigurasi bobot 4D")
    owner_id: int = Field(default=1, description="ID recruiter pemilik lowongan")


class UpdateJobRequest(JobProfileFields):
    title: Optional[str] = None
    department: Optional[str] = None
    raw_text: Optional[str] = None
    core_competencies: Optional[List[str]] = None
    weight_config: Optional[WeightConfigSchema] = None
    status: Optional[str] = None


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: CreateJobRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager")),
):
    """
    Creates a new job description with custom 4D weights and core competencies stored per job.
    """
    # Authenticated recruiter owns the job record
    if isinstance(current_user, dict) and current_user.get("id"):
        payload.owner_id = int(current_user["id"])
    # Ensure owner exists or fallback to default
    user_res = await db.execute(text("SELECT id FROM users WHERE id = :uid"), {"uid": payload.owner_id})
    if not user_res.first():
        payload.owner_id = 1

    comp_json = json.dumps(payload.core_competencies)
    w_json = json.dumps(payload.weight_config.model_dump())
    profile = payload.as_params()

    insert_query = text("""
        INSERT INTO job_descriptions (
            owner_id, title, department, raw_text, core_competencies, weight_config, status,
            company_name, company_logo_url, company_about, company_address,
            company_industry, company_website, job_function, employment_level,
            location, deadline, description_text, requirements_text
        )
        VALUES (
            :owner_id, :title, :department, :raw_text, :core_competencies, :weight_config, 'active',
            :company_name, :company_logo_url, :company_about, :company_address,
            :company_industry, :company_website, :job_function, :employment_level,
            :location, :deadline, :description_text, :requirements_text
        )
    """)
    res = await db.execute(insert_query, {
        "owner_id": payload.owner_id,
        "title": payload.title,
        "department": payload.department,
        "raw_text": payload.raw_text,
        "core_competencies": comp_json,
        "weight_config": w_json,
        **profile,
    })
    await db.commit()

    new_id = res.lastrowid
    return {
        "status": "success",
        "message": "Lowongan kerja dan konfigurasi bobot 4D berhasil disimpan.",
        "data": {
            "id": new_id,
            "title": payload.title,
            "department": payload.department,
            "raw_text": payload.raw_text,
            "core_competencies": payload.core_competencies,
            "weight_config": payload.weight_config.model_dump(),
            "status": "active",
            **profile,
        },
    }


@router.put("/{job_id}")
async def update_job(
    job_id: int,
    payload: UpdateJobRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager")),
):
    """
    Updates job opening details or modifies 4D scoring weights per job.
    """
    check = await db.execute(text("SELECT id FROM job_descriptions WHERE id = :id"), {"id": job_id})
    if not check.first():
        raise HTTPException(status_code=404, detail="JOB_NOT_FOUND")

    updates = []
    params: Dict[str, Any] = {"id": job_id}

    if payload.title is not None:
        updates.append("title = :title")
        params["title"] = payload.title
    if payload.department is not None:
        updates.append("department = :department")
        params["department"] = payload.department
    if payload.raw_text is not None:
        updates.append("raw_text = :raw_text")
        params["raw_text"] = payload.raw_text
    if payload.core_competencies is not None:
        updates.append("core_competencies = :core_competencies")
        params["core_competencies"] = json.dumps(payload.core_competencies)
    if payload.weight_config is not None:
        updates.append("weight_config = :weight_config")
        params["weight_config"] = json.dumps(payload.weight_config.model_dump())
    if payload.status is not None:
        updates.append("status = :status")
        params["status"] = payload.status

    # Profil publik: hanya kolom yang benar-benar dikirim. `exclude_unset` penting
    # di sini karena `None` yang eksplisit berarti "kosongkan", sedangkan field
    # yang tidak dikirim sama sekali harus dibiarkan apa adanya.
    sent = payload.model_dump(exclude_unset=True)
    for field in JobProfileFields.PROFILE_FIELDS:
        if field not in sent:
            continue
        value = sent[field]
        if field == "deadline" and value is not None:
            value = value.isoformat()
        updates.append(f"{field} = :{field}")
        params[field] = value

    if updates:
        sql = f"UPDATE job_descriptions SET {', '.join(updates)} WHERE id = :id"
        await db.execute(text(sql), params)
        await db.commit()

    return {"status": "success", "message": "Lowongan kerja dan bobot 4D berhasil diperbarui."}


@router.get("")
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager", "compliance_officer")),
):
    """Lists all active job openings with core competencies and baseline weights."""
    res = await db.execute(
        text("""
            SELECT id, title, department, raw_text, core_competencies, weight_config, status,
                   company_name, company_logo_url, company_about, company_address,
                   company_industry, company_website, job_function, employment_level,
                   location, deadline, description_text, requirements_text
            FROM job_descriptions WHERE status = 'active'
        """)
    )
    rows = []
    for r in res.mappings():
        comp = r["core_competencies"]
        if isinstance(comp, str):
            try:
                comp = json.loads(comp)
            except Exception:
                comp = []
        w = r["weight_config"]
        if isinstance(w, str):
            try:
                w = json.loads(w)
            except Exception:
                w = {}
        rows.append({
            "id": r["id"],
            "title": r["title"],
            "department": r["department"],
            "raw_text": r["raw_text"],
            "core_competencies": comp,
            "weight_config": w,
            "status": r["status"],
            # Profil publik ikut di list: modal edit di JobManagement dibuka dari
            # baris tabel ini. Tanpa kolomnya di sini, form terbuka kosong dan
            # menyimpan akan menghapus profil yang sudah diisi.
            "company_name": r["company_name"],
            "company_logo_url": r["company_logo_url"],
            "company_about": r["company_about"],
            "company_address": r["company_address"],
            "company_industry": r["company_industry"],
            "company_website": r["company_website"],
            "job_function": r["job_function"],
            "employment_level": r["employment_level"],
            "location": r["location"],
            "deadline": r["deadline"].isoformat() if r["deadline"] else None,
            "description_text": r["description_text"],
            "requirements_text": r["requirements_text"],
        })
    return {"data": rows, "count": len(rows)}


@router.get("/{job_id}")
async def get_job_detail(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager", "compliance_officer")),
):
    """Retrieves specific job description and configuration."""
    res = await db.execute(
        text("SELECT * FROM job_descriptions WHERE id = :id"),
        {"id": job_id},
    )
    job = res.mappings().first()
    if not job:
        raise HTTPException(status_code=404, detail="JOB_NOT_FOUND")

    comp = job["core_competencies"]
    if isinstance(comp, str):
        try:
            comp = json.loads(comp)
        except Exception:
            comp = []

    w = job["weight_config"]
    if isinstance(w, str):
        try:
            w = json.loads(w)
        except Exception:
            w = {}

    return {
        "id": job["id"],
        "title": job["title"],
        "department": job["department"],
        "raw_text": job["raw_text"],
        "core_competencies": comp,
        "weight_config": w,
        "status": job["status"],
        "created_at": job["created_at"].isoformat() if job["created_at"] else None,
        # Profil publik dipakai form admin Job Management, bukan hanya portal.
        "company_name": job["company_name"],
        "company_logo_url": job["company_logo_url"],
        "company_about": job["company_about"],
        "company_address": job["company_address"],
        "company_industry": job["company_industry"],
        "company_website": job["company_website"],
        "job_function": job["job_function"],
        "employment_level": job["employment_level"],
        "location": job["location"],
        "deadline": job["deadline"].isoformat() if job["deadline"] else None,
        "description_text": job["description_text"],
        "requirements_text": job["requirements_text"],
        "flagged_ambiguities": json.loads(job["flagged_ambiguities"]) if isinstance(job["flagged_ambiguities"], str) else job["flagged_ambiguities"],
    }


@router.post("/{job_id}/simulate-policy")
async def simulate_policy(
    job_id: int,
    payload: PolicySimulationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager")),
):
    """
    PRD Bab 8.2 (Item 11) & Bab 5.2:
    In-Memory What-If Policy Simulation Studio (Zero LLM Re-call).
    Re-scores candidate pool instantly using client-provided slider weights
    and dynamic threshold `min_overall_score`.
    """
    # 1. Verify Job existence
    job_res = await db.execute(
        text("SELECT id, title, department, weight_config FROM job_descriptions WHERE id = :id"),
        {"id": job_id},
    )
    job = job_res.mappings().first()
    if not job:
        raise HTTPException(status_code=404, detail="JOB_NOT_FOUND")

    # 2. Fetch all candidates with evaluated dimension scores
    cands_res = await db.execute(
        text("""
            SELECT id, masked_identifier, overall_score, dimension_scores,
                   confidence_level, unresolved_risk, recommendation, triage_priority
            FROM candidates
            WHERE job_id = :job_id AND is_deleted = FALSE AND dimension_scores IS NOT NULL
        """),
        {"job_id": job_id},
    )
    cand_rows = list(cands_res.mappings().all())

    # 3. Check for prompt injection / security quarantine anomalies
    cand_ids = [c["id"] for c in cand_rows]
    quarantined_ids = set()
    if cand_ids:
        # Check candidate_anomalies for HIGH severity prompt injection. Match both the
        # legacy codes and the SECURITY_QUARANTINE_* codes the scoring engine actually emits.
        anom_res = await db.execute(
            text(
                "SELECT candidate_id FROM candidate_anomalies "
                "WHERE candidate_id IN :ids AND ("
                "anomaly_type IN ('PROMPT_INJECTION', 'HIDDEN_TEXT') "
                "OR anomaly_type LIKE 'SECURITY_QUARANTINE%')"
            ),
            {"ids": tuple(cand_ids)},
        )
        for row in anom_res.fetchall():
            quarantined_ids.add(row[0])

    # 4. In-Memory Re-scoring & Re-ranking
    w = payload.weights
    new_weights = {
        "SKILL": w.SKILL,
        "EXPERIENCE": w.EXPERIENCE,
        "EDUCATION": w.EDUCATION,
        "PORTFOLIO": w.PORTFOLIO,
    }

    baseline_dist = {"STRONG_MATCH": 0, "REVIEW_REQUIRED": 0, "WEAK_FIT": 0}
    simulated_dist = {"STRONG_MATCH": 0, "REVIEW_REQUIRED": 0, "WEAK_FIT": 0}

    simulated_candidates: List[Dict[str, Any]] = []

    for c in cand_rows:
        dims = c["dimension_scores"]
        if isinstance(dims, str):
            try:
                dims = json.loads(dims)
            except Exception:
                dims = {}

        skill_s = float(dims.get("SKILL", 0.0))
        exp_s = float(dims.get("EXPERIENCE", 0.0))
        edu_s = float(dims.get("EDUCATION", 0.0))
        port_s = float(dims.get("PORTFOLIO", 0.0))

        # In-memory linear re-weighting
        sim_overall = (
            (skill_s * new_weights["SKILL"])
            + (exp_s * new_weights["EXPERIENCE"])
            + (edu_s * new_weights["EDUCATION"])
            + (port_s * new_weights["PORTFOLIO"])
        )
        sim_overall = round(sim_overall, 2)

        conf = c["confidence_level"] or "MEDIUM"
        risk = c["unresolved_risk"] or "LOW"
        is_quarantined = c["id"] in quarantined_ids

        # Re-evaluate decision points with dynamic min_overall_score
        sim_rec, sim_prio, rule = DeterministicScoringEngine.evaluate_decision_points(
            overall_score=sim_overall,
            confidence=conf,
            risk=risk,
            has_prompt_injection=is_quarantined,
            cutoff_threshold=payload.min_overall_score,
        )

        base_rec = c["recommendation"] or "REVIEW_REQUIRED"
        if base_rec in baseline_dist:
            baseline_dist[base_rec] += 1
        if sim_rec in simulated_dist:
            simulated_dist[sim_rec] += 1

        curr_overall = float(c["overall_score"]) if c["overall_score"] is not None else 0.0
        delta = round(sim_overall - curr_overall, 2)

        simulated_candidates.append({
            "id": c["id"],
            "masked_identifier": c["masked_identifier"],
            "dimension_scores": {
                "SKILL": skill_s,
                "EXPERIENCE": exp_s,
                "EDUCATION": edu_s,
                "PORTFOLIO": port_s,
            },
            "baseline": {
                "overall_score": curr_overall,
                "recommendation": base_rec,
                "triage_priority": c["triage_priority"],
            },
            "simulated": {
                "overall_score": sim_overall,
                "recommendation": sim_rec,
                "triage_priority": sim_prio,
                "rule_applied": rule,
                "delta_score": delta,
            },
            "confidence_level": conf,
            "unresolved_risk": risk,
            "is_quarantined": is_quarantined,
        })

    # Sort simulated candidates by simulated_overall_score DESC
    simulated_candidates.sort(key=lambda x: x["simulated"]["overall_score"], reverse=True)

    distribution_delta = {
        "STRONG_MATCH": simulated_dist["STRONG_MATCH"] - baseline_dist["STRONG_MATCH"],
        "REVIEW_REQUIRED": simulated_dist["REVIEW_REQUIRED"] - baseline_dist["REVIEW_REQUIRED"],
        "WEAK_FIT": simulated_dist["WEAK_FIT"] - baseline_dist["WEAK_FIT"],
    }

    return {
        "job_id": job["id"],
        "job_title": job["title"],
        "department": job["department"],
        "simulation_parameters": {
            "weights": new_weights,
            "min_overall_score": payload.min_overall_score,
        },
        "summary": {
            "total_evaluated_candidates": len(simulated_candidates),
            "baseline_distribution": baseline_dist,
            "simulated_distribution": simulated_dist,
            "distribution_delta": distribution_delta,
        },
        "ranking": simulated_candidates,
    }


class BiasAnalysisRequest(BaseModel):
    custom_text: Optional[str] = Field(None, description="Teks kustom untuk analisis sebelum disimpan ke database")


@router.post("/{job_id}/analyze-bias")
async def analyze_job_bias(
    job_id: int,
    payload: Optional[BiasAnalysisRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager", "compliance_officer")),
):
    """
    PRD Bab 8.1 & Bab 8.2 (Item 9):
    FR-1 Job Analyzer: Scans job description against gender-exclusive terms,
    age discrimination, institutional prestige bias, and toxic workplace ambiguity.
    Calculates Inclusivity Score and persists flagged ambiguities.
    """
    job_res = await db.execute(
        text("SELECT id, title, department, raw_text, flagged_ambiguities FROM job_descriptions WHERE id = :id"),
        {"id": job_id},
    )
    job = job_res.mappings().first()
    if not job:
        raise HTTPException(status_code=404, detail="JOB_NOT_FOUND")

    text_to_analyze = (payload.custom_text if payload and payload.custom_text else job["raw_text"]) or ""

    # Rule-based linguistic patterns for recruitment equity
    bias_rules = [
        # 1. Gender-Coded / Exclusive Language
        {
            "category": "GENDER_EXCLUSIVE_TERMS",
            "severity": "HIGH",
            "regex": r"(?i)\b(ninja|rockstar|hacker|guru|superhero|pria/wanita|diutamakan\s+(?:wanita|pria|laki-laki|perempuan)|berpenampilan\s+menarik|tampan|cantik)\b",
            "suggestion": "Gunakan padanan netral berbasis kompetensi seperti 'Engineer', 'Specialist', atau 'Professional'. Hapus persyaratan penampilan/gender.",
        },
        # 2. Age Discrimination (UU Ketenagakerjaan & EEO Guidelines)
        {
            "category": "AGE_DISCRIMINATION",
            "severity": "HIGH",
            "regex": r"(?i)\b(?:usia|umur)\s*(?:maksimal|max|maks)\s*\d+|\b(?:maksimal|max)\s*(?:usia|umur)\s*\d+|\bfresh\s+graduate\s+usia\s+muda\b|\bmuda\s+dan\s+energik\b",
            "suggestion": "Fokuskan pada capaian keterampilan dan penguasaan teknologi teknis, bukan batasan umur biologis.",
        },
        # 3. Socioeconomic & Institutional Prestige Bias
        {
            "category": "INSTITUTION_PRESTIGE_BIAS",
            "severity": "MEDIUM",
            "regex": r"(?i)\b(lulusan\s+ptn\s+ternama|universitas\s+terkemuka|top\s+(?:3|5|10)\s+kampus|hanya\s+ptn|ipk\s*(?:minimal|min|>=|>)\s*3\.[5-9]\d*)\b",
            "suggestion": "Gantikan rujukan almamater elitis dengan asesmen portofolio objektif dan uji keterampilan terstandarisasi.",
        },
        # 4. Toxic Work Ambiguity
        {
            "category": "AMBIGUOUS_WORK_EXPECTATIONS",
            "severity": "LOW",
            "regex": r"(?i)\b(siap\s+kerja\s+24/7|tanpa\s+mengenal\s+waktu|tahan\s+banting\s+di\s+bawah\s+tekanan\s+ekstrem|bersedia\s+lembur\s+kapanpun)\b",
            "suggestion": "Perjelas ekspektasi jam kerja, SLA tim, dan manajemen beban kerja yang berkelanjutan.",
        },
    ]

    findings = []

    for rule in bias_rules:
        matches = list(re.finditer(rule["regex"], text_to_analyze))
        for m in matches:
            matched_term = m.group(0)
            start_pos = max(0, m.start() - 30)
            end_pos = min(len(text_to_analyze), m.end() + 30)
            snippet = f"...{text_to_analyze[start_pos:end_pos].strip()}..."

            findings.append({
                "category": rule["category"],
                "severity": rule["severity"],
                "matched_term": matched_term,
                "context_snippet": snippet,
                "actionable_suggestion": rule["suggestion"],
            })

    inclusivity_score, inclusivity_rating = inclusivity_from_findings(findings)

    # Persist audit result to database
    findings_json = json.dumps(findings)
    await db.execute(
        text("UPDATE job_descriptions SET flagged_ambiguities = :flags WHERE id = :id"),
        {"flags": findings_json, "id": job_id},
    )
    await db.commit()

    return {
        "status": "success",
        "job_id": job_id,
        "title": job["title"],
        "inclusivity_score": inclusivity_score,
        "inclusivity_rating": inclusivity_rating,
        "total_bias_flags": len(findings),
        "bias_findings": findings,
        "compliance_notes": "Selaras asas nondiskriminasi Pasal 5 & 6 UU No. 13 Tahun 2003 tentang Ketenagakerjaan dan target SDG 8.5.",
    }
