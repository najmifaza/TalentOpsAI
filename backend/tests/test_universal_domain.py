import pytest
from app.api.jobs import infer_is_tech_role, generate_dynamic_taxonomies
from app.core.scoring import (
    DeterministicScoringEngine,
    calculate_relevance,
    is_tier3_metric_claim,
)


def test_infer_is_tech_role():
    assert infer_is_tech_role("Senior Backend Engineer", "Core Engineering", "FastAPI and Docker") is True
    assert infer_is_tech_role("Frontend Developer", "Web", "React 18 and Tailwind") is True
    assert infer_is_tech_role("Staff Akuntan Pajak", "Finance", "Menyusun laporan keuangan dan SPT PPh 21") is False
    assert infer_is_tech_role("Corporate Legal Officer", "Legal", "Drafting kontrak kerja sama dan audit kepatuhan hukum") is False
    assert infer_is_tech_role("HR Talent Acquisition Specialist", "Human Resources", "Sourcing dan screening kandidat") is False
    assert infer_is_tech_role("Content Writer & Copywriter", "Marketing", "Menulis artikel SEO dan naskah kampanye") is False


def test_generate_dynamic_taxonomies():
    tax = generate_dynamic_taxonomies(["Pajak PPh 21", "Drafting Kontrak", "FastAPI"])
    assert "Pajak PPh 21" in tax
    assert "pph 21" in tax["Pajak PPh 21"]
    assert "withholding tax" in tax["Pajak PPh 21"]
    assert "Drafting Kontrak" in tax
    assert "perjanjian kerja sama" in tax["Drafting Kontrak"]
    assert "FastAPI" in tax
    assert "python" in tax["FastAPI"]


def test_dynamic_taxonomy_relevance():
    custom_tax = {
        "Pajak PPh 21": ["pajak penghasilan", "withholding tax", "bukti potong 1721"],
        "Drafting Kontrak": ["perjanjian kerja sama", "mou", "nda"],
    }
    # Exact match
    assert calculate_relevance("Pajak PPh 21", "Pajak PPh 21", custom_tax) == 1.0
    # Dynamic synonym match
    assert calculate_relevance("withholding tax", "Pajak PPh 21", custom_tax) == 0.7
    assert calculate_relevance("perjanjian kerja sama", "Drafting Kontrak", custom_tax) == 0.7
    # Irrelevant
    assert calculate_relevance("Java Spring", "Pajak PPh 21", custom_tax) == 0.0


def test_non_it_portfolio_scoring_no_penalty():
    # Programmer without repos -> 0.0
    assert DeterministicScoringEngine.calculate_portfolio_score({}, is_programmer_role=True, portfolio_url=None) == 0.0

    # Non-IT with portfolio link -> 100.0
    assert DeterministicScoringEngine.calculate_portfolio_score(
        {}, is_programmer_role=False, portfolio_url="https://drive.google.com/file/d/portfolio"
    ) == 100.0

    # Non-IT without portfolio link -> 70.0 (no zero penalty)
    assert DeterministicScoringEngine.calculate_portfolio_score(
        {}, is_programmer_role=False, portfolio_url=None
    ) == 70.0


def test_non_it_education_scoring():
    law_edu = {"degree": "S1", "field_of_study": "Ilmu Hukum"}
    # IT role penalizes non-IT degree
    assert DeterministicScoringEngine.calculate_education_score(law_edu, is_programmer_role=True) == 20.0
    # Non-IT role honors universal bachelor degree
    assert DeterministicScoringEngine.calculate_education_score(law_edu, is_programmer_role=False) == 60.0

    master_law = {"degree": "S2", "field_of_study": "Magister Kenotariatan"}
    assert DeterministicScoringEngine.calculate_education_score(master_law, is_programmer_role=False) == 100.0


def test_business_and_finance_metrics():
    # Quantified business metrics should qualify for Tier 3
    assert is_tier3_metric_claim("berhasil meningkatkan omzet sebesar 35%", "peningkatan omzet 35%") is True
    assert is_tier3_metric_claim("mengelola anggaran operasional sebesar 2.5 miliar rupiah", "anggaran 2.5 miliar") is True
    assert is_tier3_metric_claim("menurunkan tingkat turnover karyawan hingga 12%", "turnover berkurang 12%") is True
    assert is_tier3_metric_claim("menyelesaikan 45 kontrak bisnis dengan SLA 99%", "45 kontrak") is True


def test_non_it_adaptive_challenge_question():
    assessment = DeterministicScoringEngine.compute_full_assessment(
        claims=[
            {
                "dimension": "SKILL",
                "technology": "Pajak PPh 21",
                "has_implementation_detail": True,
                "context_narrative": "mengelola rekonsiliasi pajak pph 21 bulanan senilai 500 juta",
                "metric_string": "500 juta",
            }
        ],
        career_timeline=[
            {"role": "Tax Staff", "start": "2023-01", "end": "2024-12", "is_relevant_role": True}
        ],
        education={"degree": "S1", "field_of_study": "Akuntansi"},
        anomalies={"overlapping_dates_detected": True}, # Triggers risk
        core_competencies=["Pajak PPh 21", "Laporan Keuangan"],
        verified_repos={},
        is_programmer_role=False,
        portfolio_url="https://drive.google.com/file/d/cv_portfolio",
        job_title="Staff Akuntan & Pajak",
    )

    challenges = assessment.get("adaptive_challenges", [])
    assert len(challenges) > 0
    q = challenges[0]["scenario_question"]
    # Question must be contextual to the job title and target the unmastered competency (Laporan Keuangan)
    assert "concurrency control" not in q
    assert "Staff Akuntan & Pajak" in q
    assert "Laporan Keuangan" in q


def test_claude_audit_edge_cases():
    from app.core.scoring import merge_employment_intervals, normalize_technology_key

    # Substring boundaries
    assert calculate_relevance("mongodb", "go") == 0.0
    assert calculate_relevance("javascript", "java") == 0.0
    assert calculate_relevance("docker", "go") == 0.0

    # Metric & context detection
    assert is_tier3_metric_claim("melayani 1.000.000 pengguna", None) is True
    assert is_tier3_metric_claim("mengelola 5 karyawan", None) is False  # Headcount without business metric

    # Dates parsing and interval merging
    assert merge_employment_intervals([{"start": "2020", "end": "2023"}]) == 4.0
    assert merge_employment_intervals([{"start": "2024-01", "end": None}]) > 0

    # Distinct language keys
    assert normalize_technology_key("C++") != normalize_technology_key("C#")
    assert normalize_technology_key("C++") != normalize_technology_key("C")
    assert normalize_technology_key("Next.js") == normalize_technology_key("nextjs")

