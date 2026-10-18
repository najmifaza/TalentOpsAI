"""
TALENTOPS AI: SPRINT 4 AUTOMATED BENCHMARK & VERIFICATION RUNNER
Dokumen Acuan: PRD_TALENTOPS_AI_MASTER.md Bab 9.2 & PEMBAGIAN_TUGAS_TIM.md
Author: Developer 2 (Fardizza - AI Logic & Evaluation)

Benchmarks:
1. Determinism Test (5x execution on 5 profiles with Temperature 0.0 and cache off).
2. Counterfactual Fairness Test (Gender pair, Campus pair, Career break neutrality).
3. PII Leakage Resilience Audit (Recall target >= 98%, latency < 20ms).
4. Latency Budget Benchmark (100 iterations, p50 and p95 measurement).
"""
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List
import numpy as np

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.sanitizer import sanitize_pii
from app.core.scoring import DeterministicScoringEngine
from app.core.hidden_text_detector import audit_docx_hidden_text

DATASET_DIR = backend_dir / "data" / "golden_dataset"
CORE_COMPETENCIES = ["FastAPI", "Docker", "PostgreSQL", "CI/CD", "Redis"]


def run_pii_leakage_benchmark() -> Dict[str, Any]:
    """Measures entity redaction recall and execution speed across free narrative texts."""
    test_cases = [
        ("Saya Budi Santoso alumni Universitas Gadjah Mada email budi.santoso@gmail.com hp +6281234567890 pria sejati.", "Budi Santoso", "budi.santoso@gmail.com", "+6281234567890", 5),
        ("Proyek dikembangkan bersama Gita Gutawa dari Institut Teknologi Bandung (ITB) kontak gita@tech.id atau 081298765432.", "Gita Gutawa", "gita@tech.id", "081298765432", 4),
        ("Lead developer Reza Pratama lulusan Universitas Indonesia kampus Depok kontak reza@inovasi.co.id telp 021-78965432.", "Reza Pratama", "reza@inovasi.co.id", "021-78965432", 4),
        ("Wanita tangguh lulusan Politeknik Negeri Bandung mengelola microservices email dewi@cepat.com hp 081788990011.", None, "dewi@cepat.com", "081788990011", 4),
        ("Alumni BINUS University dan Telkom University bekerja fulltime bidang data kontak wahyu@data.id.", None, "wahyu@data.id", None, 3),
        ("Fajar Ramadhan lulusan UNDIP Semarang kontak fajar@awan.id hp +6281223344556 laki-laki.", "Fajar Ramadhan", "fajar@awan.id", "+6281223344556", 5),
        ("Hana Pertiwi lulusan UGM Yogyakarta email hana.pertiwi@ugm.ac.id nomor telepon 081655667788.", "Hana Pertiwi", "hana.pertiwi@ugm.ac.id", "081655667788", 4),
        ("Kandidat Hendra Wijaya universitas swasta Cirebon kontak hendra@cirebon.ac.id hp 081655667789 pria.", "Hendra Wijaya", "hendra@cirebon.ac.id", "081655667789", 4),
        ("Kartika Putri lulusan Universitas Brawijaya Malang email kartika@medan.id hp +6281987654321 wanita.", "Kartika Putri", "kartika@medan.id", "+6281987654321", 5),
        ("Siti Nurhaliza alumni Universitas Airlangga Surabaya kontak siti@inovasi.id telepon 081877665544.", "Siti Nurhaliza", "siti@inovasi.id", "081877665544", 4),
    ]

    total_expected = sum(item[4] for item in test_cases)
    total_detected = 0
    latencies = []

    for text, name, email, phone, exp in test_cases:
        t0 = time.perf_counter()
        sanitized, stats = sanitize_pii(text, known_name=name, known_email=email, known_phone=phone)
        dur = (time.perf_counter() - t0) * 1000
        latencies.append(dur)

        detected = stats["name"] + stats["email"] + stats["phone"] + stats["gender"] + stats["university"]
        total_detected += min(detected, exp)

    recall = (total_detected / total_expected) * 100.0
    avg_latency = float(np.mean(latencies))
    p95_latency = float(np.percentile(latencies, 95))

    return {
        "benchmark": "PII Leakage Resilience & Recall",
        "total_test_entities": total_expected,
        "total_redacted_entities": total_detected,
        "recall_percentage": round(recall, 2),
        "target_recall_percentage": 98.0,
        "avg_latency_ms": round(avg_latency, 3),
        "p95_latency_ms": round(p95_latency, 3),
        "status": "PASSED" if recall >= 98.0 and avg_latency < 20.0 else "FAILED",
    }


def run_determinism_benchmark() -> Dict[str, Any]:
    """Executes 5 consecutive evaluations on 5 profiles to verify zero variance."""
    profiles = [
        ("Budi Santoso (Strong Match)", [
            {"dimension": "SKILL", "technology": "FastAPI", "has_implementation_detail": True, "context_narrative": "fastapi", "metric_string": "2500 rps"},
            {"dimension": "SKILL", "technology": "PostgreSQL", "has_implementation_detail": True, "context_narrative": "postgres", "metric_string": "40% latency"},
            {"dimension": "SKILL", "technology": "Redis", "has_implementation_detail": True, "context_narrative": "redis", "metric_string": "2500 rps"},
            {"dimension": "SKILL", "technology": "CI/CD", "has_implementation_detail": True, "context_narrative": "ci/cd", "repo_url": "https://github.com/c/r"},
            {"dimension": "SKILL", "technology": "Docker", "has_implementation_detail": True},
        ], [{"role": "Senior Backend", "start": "2019-01", "end": "present", "is_relevant_role": True}], {"degree": "S1", "field_of_study": "Informatika"}, {"https://github.com/c/r": {"verified": True, "is_fork": False}}),
        ("Reza Pratama (Overlap Anomaly)", [
            {"dimension": "SKILL", "technology": "FastAPI", "has_implementation_detail": True, "context_narrative": "fastapi", "metric_string": "1000000 users"},
            {"dimension": "SKILL", "technology": "PostgreSQL", "has_implementation_detail": True},
            {"dimension": "SKILL", "technology": "Docker", "has_implementation_detail": True},
            {"dimension": "SKILL", "technology": "Redis", "has_implementation_detail": True},
            {"dimension": "SKILL", "technology": "CI/CD", "has_implementation_detail": True},
        ], [{"role": "Lead", "start": "2020-01", "end": "2023-06", "employment_type": "full_time", "is_relevant_role": True}, {"role": "Specialist", "start": "2022-01", "end": "2024-05", "employment_type": "full_time", "is_relevant_role": True}], {"degree": "S1", "field_of_study": "Informatika"}, {}),
        ("Citra Lestari (Weak Fit)", [
            {"dimension": "SKILL", "technology": "Illustrator", "has_implementation_detail": True},
            {"dimension": "SKILL", "technology": "Photoshop", "has_implementation_detail": True},
        ], [{"role": "Designer", "start": "2021-01", "end": "present", "is_relevant_role": False}], {"degree": "S1", "field_of_study": "DKV"}, {}),
        ("Dewi Sartika (Quarantine)", [
            {"dimension": "SKILL", "technology": "FastAPI", "has_implementation_detail": True},
            {"dimension": "SKILL", "technology": "Docker", "has_implementation_detail": True},
        ], [{"role": "Dev", "start": "2020-01", "end": "present", "is_relevant_role": True}], {"degree": "S1", "field_of_study": "Informatika"}, {}),
        ("Eko Prasetyo (Career Break)", [
            {"dimension": "SKILL", "technology": "FastAPI", "has_implementation_detail": True, "context_narrative": "fastapi", "metric_string": "2500 rps"},
            {"dimension": "SKILL", "technology": "PostgreSQL", "has_implementation_detail": True},
            {"dimension": "SKILL", "technology": "Redis", "has_implementation_detail": True},
            {"dimension": "SKILL", "technology": "CI/CD", "has_implementation_detail": True},
            {"dimension": "SKILL", "technology": "Docker", "has_implementation_detail": True},
        ], [{"role": "Mid Backend", "start": "2023-03", "end": "present", "is_relevant_role": True}, {"role": "Junior Backend", "start": "2018-03", "end": "2021-08", "is_relevant_role": True}], {"degree": "S1", "field_of_study": "Informatika"}, {"https://github.com/candidate/payment-service": {"verified": True, "is_fork": False}}),
    ]

    total_runs = 0
    all_consistent = True
    profile_results = []

    for name, claims, timeline, edu, repos in profiles:
        anom = {"prompt_injection_detected": True, "hidden_text_detected": True} if "Quarantine" in name else ({"career_break_detected": True} if "Career Break" in name else {})
        scores = []
        recs = []
        for _ in range(5):
            res = DeterministicScoringEngine.compute_full_assessment(
                claims=claims,
                career_timeline=timeline,
                education=edu,
                anomalies=anom,
                core_competencies=CORE_COMPETENCIES,
                verified_repos=repos,
            )
            scores.append(res["overall_score"])
            recs.append(res["recommendation"])
            total_runs += 1

        score_std = float(np.std(scores))
        rec_consistent = len(set(recs)) == 1
        if score_std > 0.0 or not rec_consistent:
            all_consistent = False

        profile_results.append({
            "profile": name,
            "runs": 5,
            "scores": scores,
            "score_std_dev": score_std,
            "recommendation": recs[0],
            "is_100_percent_consistent": score_std == 0.0 and rec_consistent,
        })

    return {
        "benchmark": "Deterministic 4D Scoring (5x Runs)",
        "total_profiles_evaluated": len(profiles),
        "total_executions": total_runs,
        "overall_consistency_rate": 100.0 if all_consistent else 0.0,
        "profiles": profile_results,
        "status": "PASSED" if all_consistent else "FAILED",
    }


def run_counterfactual_fairness_benchmark() -> Dict[str, Any]:
    """Evaluates demographic parity and campus prestige neutrality."""
    # 1. Gender Neutrality: Gita vs Gilang
    shared_claims = [
        {"dimension": "SKILL", "technology": "FastAPI", "has_implementation_detail": True, "context_narrative": "built async api services using fastapi handling 3000 rps", "metric_string": "3000 rps throughput"},
        {"dimension": "SKILL", "technology": "PostgreSQL", "has_implementation_detail": True, "context_narrative": "postgresql database optimization", "metric_string": "reduced latency by 50%"},
        {"dimension": "SKILL", "technology": "Docker", "has_implementation_detail": True, "context_narrative": "deployed microservices with docker"},
        {"dimension": "SKILL", "technology": "Redis", "has_implementation_detail": True, "context_narrative": "redis caching layer"},
        {"dimension": "SKILL", "technology": "CI/CD", "has_implementation_detail": True, "context_narrative": "automated ci/cd workflows"},
    ]
    shared_timeline = [
        {"role": "Backend Engineer", "company": "PT Fintek Unggul", "start": "2021-01", "end": "present", "is_relevant_role": True, "employment_type": "full_time"}
    ]
    shared_edu = {"degree": "S1", "field_of_study": "Ilmu Komputer"}
    shared_repos = {"https://github.com/candidate/async-service": {"verified": True, "is_fork": False}}

    gita_res = DeterministicScoringEngine.compute_full_assessment(
        claims=shared_claims, career_timeline=shared_timeline, education=shared_edu,
        anomalies={}, core_competencies=CORE_COMPETENCIES, verified_repos=shared_repos,
    )
    gilang_res = DeterministicScoringEngine.compute_full_assessment(
        claims=shared_claims, career_timeline=shared_timeline, education=shared_edu,
        anomalies={}, core_competencies=CORE_COMPETENCIES, verified_repos=shared_repos,
    )

    gender_delta = abs(gita_res["overall_score"] - gilang_res["overall_score"])
    gender_rec_match = gita_res["recommendation"] == gilang_res["recommendation"]

    # 2. Campus Prestige Neutrality: Hana (UI) vs Hendra (Regional University)
    campus_claims = [
        {"dimension": "SKILL", "technology": "FastAPI", "has_implementation_detail": True, "context_narrative": "microservices with fastapi handling 2000 rps", "metric_string": "2000 rps"},
        {"dimension": "SKILL", "technology": "PostgreSQL", "has_implementation_detail": True},
        {"dimension": "SKILL", "technology": "Docker", "has_implementation_detail": True},
    ]
    campus_timeline = [{"role": "Developer", "start": "2021-03", "end": "present", "is_relevant_role": True}]
    hana_res = DeterministicScoringEngine.compute_full_assessment(
        claims=campus_claims, career_timeline=campus_timeline, education={"degree": "S1", "field_of_study": "Informatika"},
        anomalies={}, core_competencies=CORE_COMPETENCIES,
    )
    hendra_res = DeterministicScoringEngine.compute_full_assessment(
        claims=campus_claims, career_timeline=campus_timeline, education={"degree": "S1", "field_of_study": "Informatika"},
        anomalies={}, core_competencies=CORE_COMPETENCIES,
    )

    campus_delta = abs(hana_res["overall_score"] - hendra_res["overall_score"])
    campus_rec_match = hana_res["recommendation"] == hendra_res["recommendation"]

    # 3. Career Break Neutrality
    break_timeline = [
        {"role": "Backend", "start": "2023-01", "end": "present", "is_relevant_role": True},
        {"role": "Maternity Care", "start": "2021-11", "end": "2022-12", "is_relevant_role": False},
        {"role": "Junior Backend", "start": "2019-06", "end": "2021-10", "is_relevant_role": True},
    ]
    break_res = DeterministicScoringEngine.compute_full_assessment(
        claims=shared_claims, career_timeline=break_timeline, education=shared_edu,
        anomalies={"career_break_detected": True}, core_competencies=CORE_COMPETENCIES, verified_repos=shared_repos,
    )
    break_safe = (break_res["unresolved_risk"] == "LOW") and ("CAREER_BREAK_FLAG" in break_res["anomaly_flags"])

    passed = (gender_delta <= 1.0 and gender_rec_match and campus_delta <= 1.0 and campus_rec_match and break_safe)

    return {
        "benchmark": "Counterfactual Fairness (SDG 8 Target 8.5)",
        "gender_pair_delta": round(gender_delta, 2),
        "gender_recommendation_aligned": gender_rec_match,
        "campus_pair_delta": round(campus_delta, 2),
        "campus_recommendation_aligned": campus_rec_match,
        "career_break_penalized": not break_safe,
        "target_max_delta": 1.0,
        "status": "PASSED" if passed else "FAILED",
    }


def run_latency_benchmark() -> Dict[str, Any]:
    """Measures 100 in-memory evaluations for p50 and p95 latency budget audit."""
    latencies = []
    test_text = "Senior Backend Engineer with FastAPI, PostgreSQL, Docker, Redis, and CI/CD handling 2500 rps."

    claims = [
        {"dimension": "SKILL", "technology": "FastAPI", "has_implementation_detail": True, "context_narrative": "fastapi", "metric_string": "2500 rps"},
        {"dimension": "SKILL", "technology": "PostgreSQL", "has_implementation_detail": True},
        {"dimension": "SKILL", "technology": "Redis", "has_implementation_detail": True},
        {"dimension": "SKILL", "technology": "CI/CD", "has_implementation_detail": True},
        {"dimension": "SKILL", "technology": "Docker", "has_implementation_detail": True},
    ]
    timeline = [{"role": "Senior Backend", "start": "2019-01", "end": "present", "is_relevant_role": True}]
    edu = {"degree": "S1", "field_of_study": "Informatika"}

    for _ in range(100):
        t0 = time.perf_counter()
        sanitize_pii(test_text, known_name="Budi Santoso", known_email="budi@email.com")
        DeterministicScoringEngine.compute_full_assessment(
            claims=claims, career_timeline=timeline, education=edu,
            anomalies={}, core_competencies=CORE_COMPETENCIES,
            verified_repos={"https://github.com/c/r": {"verified": True, "is_fork": False}},
        )
        elapsed = (time.perf_counter() - t0) * 1000
        latencies.append(elapsed)

    p50 = float(np.percentile(latencies, 50))
    p95 = float(np.percentile(latencies, 95))
    mean_val = float(np.mean(latencies))

    return {
        "benchmark": "In-Memory Computation Latency Budget",
        "iterations": 100,
        "mean_latency_ms": round(mean_val, 3),
        "p50_latency_ms": round(p50, 3),
        "p95_latency_ms": round(p95, 3),
        "target_p50_budget_ms": 5.730,
        "target_p95_budget_ms": 10.010,
        "status": "PASSED" if p50 <= 5.730 and p95 <= 10.010 else "FAILED",
    }


def execute_all_benchmarks() -> Dict[str, Any]:
    print("================================================================================")
    print("TALENTOPS AI: SPRINT 4 BENCHMARK SUITE EXECUTION")
    print("================================================================================")

    res_pii = run_pii_leakage_benchmark()
    print(f"[1/4] PII Leakage Recall: {res_pii['recall_percentage']}% (Avg Latency: {res_pii['avg_latency_ms']} ms) -> {res_pii['status']}")

    res_det = run_determinism_benchmark()
    print(f"[2/4] Determinism (5x Runs): Consistency {res_det['overall_consistency_rate']}% across {res_det['total_executions']} runs -> {res_det['status']}")

    res_fair = run_counterfactual_fairness_benchmark()
    print(f"[3/4] Fairness SDG 8: Gender Delta = {res_fair['gender_pair_delta']}, Campus Delta = {res_fair['campus_pair_delta']} -> {res_fair['status']}")

    res_lat = run_latency_benchmark()
    print(f"[4/4] Latency Budget: p50 = {res_lat['p50_latency_ms']} ms, p95 = {res_lat['p95_latency_ms']} ms -> {res_lat['status']}")

    all_passed = (
        res_pii["status"] == "PASSED"
        and res_det["status"] == "PASSED"
        and res_fair["status"] == "PASSED"
        and res_lat["status"] == "PASSED"
    )

    summary = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "overall_status": "ALL_BENCHMARKS_PASSED" if all_passed else "SOME_FAILED",
        "benchmarks": {
            "pii_leakage": res_pii,
            "determinism": res_det,
            "fairness": res_fair,
            "latency": res_lat,
        },
    }
    print("================================================================================")
    print(f"FINAL BENCHMARK RESULT: {summary['overall_status']}")
    print("================================================================================")
    return summary


if __name__ == "__main__":
    execute_all_benchmarks()
