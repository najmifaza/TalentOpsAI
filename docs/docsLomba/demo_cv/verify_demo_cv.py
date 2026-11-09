"""
Verifikasi paket CV demo memakai jalur AI yang sebenarnya.

Bukan unit test: skrip ini membaca PDF dari folder ini, mengekstraksi teks terlihat,
menjalankan sanitasi PII, memanggil LLM gateway yang sama dengan produksi, lalu menghitung
skor deterministik dengan bobot dan kompetensi lowongan yang benar-benar tersimpan di DB.

    python verify_demo_cv.py            # semua berkas
    python verify_demo_cv.py cv_04      # satu berkas saja

Butuh: gateway LLM hidup (LLM_ROUTER_BASE_URL) dan akses baca ke job_descriptions.
Kredensial DB dibaca dari env `TALENTOPS_DB_URL` (format:
`mysql://user:password@host:port/database`) — jangan ditulis di dalam berkas ini.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
BACKEND = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND))

# `Settings` reads `env_file=".env"` relative to the *current working directory*, so running
# this script from anywhere else silently loses the gateway key and every call fails with
# "Missing API key". Load the backend env explicitly before importing app modules.
try:
    from dotenv import load_dotenv

    load_dotenv(BACKEND / ".env")
except Exception:
    pass

from app.core.crosscheck import downgrade_confidence  # noqa: E402
from app.core.hidden_text_detector import audit_pdf_hidden_text  # noqa: E402
from app.core.llm_adapter import LLMAdapter  # noqa: E402
from app.core.prompt import build_extraction_prompt, clean_llm_json_response  # noqa: E402
from app.core.sanitizer import sanitize_resume  # noqa: E402
from app.core.scoring import (  # noqa: E402
    DeterministicScoringEngine,
    detect_experience_claim_inflation,
)
from app.schemas.extraction import CandidateExtractionSchema  # noqa: E402

from build_demo_cv import CVS  # noqa: E402

JOB_ID_FROM_SLUG = {}


def load_jobs():
    """Membaca konfigurasi lowongan asli dari DB (read-only)."""
    import pymysql

    dsn = os.getenv("TALENTOPS_DB_URL")
    if not dsn:
        raise SystemExit(
            "TALENTOPS_DB_URL belum diset. Contoh:\n"
            "  export TALENTOPS_DB_URL='mysql://user:pass@host:3306/talentops_db'"
        )
    parsed = urlparse(dsn)
    conn = pymysql.connect(
        host=parsed.hostname,
        port=parsed.port or 3306,
        user=unquote(parsed.username or ""),
        password=unquote(parsed.password or ""),
        database=(parsed.path or "/talentops_db").lstrip("/"),
        connect_timeout=8,
        read_timeout=20,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, core_competencies, weight_config, competency_taxonomies, is_tech_role "
                "FROM job_descriptions"
            )
            jobs = {}
            for job_id, title, comp, weights, taxonomies, is_tech in cur.fetchall():
                jobs[job_id] = {
                    "id": job_id,
                    "title": title,
                    "core_competencies": comp if isinstance(comp, list) else json.loads(comp or "[]"),
                    "weights": weights if isinstance(weights, dict) else json.loads(weights or "{}"),
                    "taxonomies": taxonomies if isinstance(taxonomies, dict) else json.loads(taxonomies or "{}"),
                    "is_tech_role": bool(is_tech),
                }
            return jobs
    finally:
        conn.close()


async def assess(spec, job, adapter):
    pdf_path = HERE / f"{spec['slug']}.pdf"
    audit = audit_pdf_hidden_text(pdf_path.read_bytes())

    if audit.requires_ocr or not audit.visible_text.strip():
        return {
            "slug": spec["slug"],
            "skipped": "butuh OCR — teks tidak tersedia (sesuai harapan untuk berkas scan)",
            "pdf_findings": sorted({f["type"] for f in audit.findings}),
        }

    sanitized = sanitize_resume(audit.visible_text)
    response = await adapter.complete(
        messages=build_extraction_prompt(sanitized.text),
        use_cache=False,
        response_format={"type": "json_object"},
    )
    schema = CandidateExtractionSchema.model_validate(
        json.loads(clean_llm_json_response(response["content"]))
    )
    schema.apply_substring_guard(sanitized.text)

    anomalies = schema.anomalies.model_dump()
    if any(f["type"] in {"PDF_WHITE_TEXT", "PDF_INVISIBLE_RENDER_MODE"} for f in audit.findings):
        anomalies["hidden_text_detected"] = True

    assessment = DeterministicScoringEngine.compute_full_assessment(
        claims=[c.model_dump() for c in schema.claims],
        career_timeline=[t.model_dump() for t in schema.career_timeline],
        education=schema.education.model_dump() if schema.education else None,
        anomalies=anomalies,
        core_competencies=job["core_competencies"],
        verified_repos={},  # verifikasi GitHub sengaja dilewati agar hasil deterministik
        weights=job["weights"],
        is_programmer_role=job["is_tech_role"],
        competency_taxonomies=job["taxonomies"],
        job_title=job["title"],
    )

    claim_inflation = detect_experience_claim_inflation(
        sanitized.text, assessment.get("merged_experience_years") or 0.0
    )
    recommendation = assessment["recommendation"]
    confidence = assessment["confidence_level"]
    if claim_inflation:
        confidence = downgrade_confidence(confidence)
        recommendation = DeterministicScoringEngine.evaluate_decision_points(
            overall_score=assessment["overall_score"],
            confidence=confidence,
            risk="MEDIUM",
            has_prompt_injection=anomalies.get("prompt_injection_detected", False),
            cutoff_threshold=85.0,
        )[0]

    return {
        "slug": spec["slug"],
        "job": job["title"],
        "score": assessment["overall_score"],
        "confidence": confidence,
        "risk": assessment["unresolved_risk"],
        "recommendation": recommendation,
        "timeline_years": assessment["merged_experience_years"],
        "weights": assessment["weights_applied"],
        "flags": assessment["anomaly_flags"],
        "claim_inflation": bool(claim_inflation),
        "claims": len(schema.claims),
        "timeline": [(t.role, t.start, t.end) for t in schema.career_timeline],
        "pdf_findings": sorted({f["type"] for f in audit.findings}),
    }


MONTHS = {
    "januari": 1, "februari": 2, "maret": 3, "april": 4, "mei": 5, "juni": 6,
    "juli": 7, "agustus": 8, "september": 9, "oktober": 10, "november": 11, "desember": 12,
}


def _period_to_range(period: str):
    """'Januari 2021 – Desember 2023' -> ('2021-01', '2023-12')."""
    import re

    parts = re.findall(r"([A-Za-z]+)\s+(\d{4})", period)
    if len(parts) < 2:
        return None, None
    (m1, y1), (m2, y2) = parts[0], parts[1]
    return f"{y1}-{MONTHS[m1.lower()]:02d}", f"{y2}-{MONTHS[m2.lower()]:02d}"


def offline_timeline(spec):
    """Timeline deterministik dari spesifikasi CV, menggantikan hasil ekstraksi LLM."""
    timeline = []
    for role_line, period, _bullets in spec["experiences"]:
        role, _, company = role_line.partition("|")
        start, end = _period_to_range(period)
        timeline.append(
            {
                "role": role.strip(),
                "company": company.strip(),
                "is_relevant_role": True,
                "employment_type": "full_time",
                "start": start,
                "end": end,
            }
        )
    return timeline


def offline_text(spec) -> str:
    parts = [spec["profile"], spec["skills"]]
    for _role, _period, bullets in spec["experiences"]:
        parts.extend(bullets)
    return "\n".join(parts)


def run_offline(only=None):
    """Mode tanpa LLM: menguji logika flag (A) dari spesifikasi CV yang sama."""
    from app.core.scoring import claimed_experience_years

    print("MODE OFFLINE — timeline diambil dari spesifikasi CV, bukan dari ekstraksi LLM\n")
    for spec in CVS:
        if only and only not in spec["slug"]:
            continue
        timeline = offline_timeline(spec)
        text = offline_text(spec)

        assessment = DeterministicScoringEngine.compute_full_assessment(
            claims=[],
            career_timeline=timeline,
            education=None,
            anomalies={},
            core_competencies=[],
            verified_repos={},
            is_programmer_role=True,
        )
        claim = detect_experience_claim_inflation(text, assessment["merged_experience_years"] or 0.0)
        claimed = claimed_experience_years(text)

        print(f"--- {spec['slug']}  [{spec['case']}]")
        print(f"    timeline  : {assessment['merged_experience_years']} tahun")
        print(f"    rentang   : {[(t['role'], t['start'], t['end']) for t in timeline]}")
        print(f"    flag      : {assessment['anomaly_flags'] or 'tidak ada'} | risiko {assessment['unresolved_risk']}")
        if claimed:
            print(f"    klaim     : {claimed} tahun -> {'TERDETEKSI' if claim else 'dalam toleransi'}")
        print()


async def main():
    if "--offline" in sys.argv:
        args = [a for a in sys.argv[1:] if not a.startswith("--")]
        run_offline(args[0] if args else None)
        return

    only = sys.argv[1] if len(sys.argv) > 1 else None
    jobs = load_jobs()
    adapter = LLMAdapter()

    print(f"Lowongan terbaca: {len(jobs)} | berkas diuji: "
          f"{sum(1 for s in CVS if not only or only in s['slug'])}\n")

    for spec in CVS:
        if only and only not in spec["slug"]:
            continue
        job_id = int(spec["job"].split("·")[0].strip())
        job = jobs.get(job_id)
        if not job:
            print(f"! lowongan {job_id} tidak ada untuk {spec['slug']}")
            continue

        try:
            result = await assess(spec, job, adapter)
        except Exception as exc:
            print(f"! {spec['slug']}: {type(exc).__name__}: {exc}")
            continue

        print(f"--- {spec['slug']}  [{spec['case']}]")
        print(f"    diharapkan : {spec['expect']}")
        if "skipped" in result:
            print(f"    hasil      : DILEWATI — {result['skipped']}")
            print(f"    temuan PDF : {result['pdf_findings'] or 'bersih'}")
            continue

        print(
            f"    hasil      : skor {result['score']} | {result['recommendation']} | "
            f"keyakinan {result['confidence']} | risiko {result['risk']}"
        )
        print(f"    bobot      : {result['weights']}")
        print(f"    timeline   : {result['timeline_years']} tahun | klaim inflasi: {result['claim_inflation']}")
        print(f"    flag       : {result['flags'] or 'tidak ada'}")
        print(f"    temuan PDF : {result['pdf_findings'] or 'bersih'}")
        print(f"    riwayat    : {result['timeline']}")
        print()


if __name__ == "__main__":
    asyncio.run(main())