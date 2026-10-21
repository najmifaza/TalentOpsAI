"""Seed scripts must import cleanly under both namespaces.

`core` modules import each other as `app.*` while the systemd unit runs `backend.app.*`.
A seed script that only puts the repo root on sys.path therefore dies with
`ModuleNotFoundError: No module named 'app'` before it reaches the database.
"""
import importlib
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
for candidate in (str(backend_dir.parent), str(backend_dir)):
    if candidate not in sys.path:
        sys.path.insert(0, candidate)


@pytest.mark.parametrize(
    "module_name, entrypoint",
    [
        ("scripts.seed_data", "seed_initial_data"),
        ("scripts.seed_demo_candidates", "seed_candidates"),
        ("scripts.seed_interview_slots", "seed_slots"),
    ],
)
def test_seed_script_imports_and_exposes_entrypoint(module_name, entrypoint):
    module = importlib.import_module(module_name)
    assert callable(getattr(module, entrypoint))


def test_app_namespace_is_resolvable():
    """The chain `app.core.auth` -> `app.core.config` is what used to break."""
    assert importlib.import_module("app.core.config").settings is not None


def test_demo_profiles_declare_github_url():
    """`github_url` was absent from the seed, so every row rendered as an anomaly."""
    profiles = importlib.import_module("scripts.seed_demo_candidates").DEMO_PROFILES
    assert all("github_url" in p for p in profiles)
    assert any(p["github_url"] for p in profiles), "no profile carries a repo URL"


def test_demo_profiles_yield_evidence_rows():
    """The seed writes candidate_evidence from these records; empty means a blank column."""
    scoring = importlib.import_module("app.core.scoring")
    profiles = importlib.import_module("scripts.seed_demo_candidates").DEMO_PROFILES
    reqs = ["FastAPI", "Docker", "MariaDB", "PostgreSQL", "CI/CD", "Redis"]
    for p in profiles:
        assessment = scoring.DeterministicScoringEngine.compute_full_assessment(
            claims=p["claims"],
            career_timeline=p["timeline"],
            education=p["education"],
            anomalies=p["anomalies"],
            core_competencies=reqs,
            verified_repos=p["repos"],
        )
        assert assessment["evidence_records"], f"no evidence for {p['masked_id']}"
        for ev in assessment["evidence_records"]:
            assert ev["dimension"] in {"SKILL", "EXPERIENCE", "EDUCATION", "PORTFOLIO"}
            assert ev["evidence_source"], "evidence_source is NOT NULL in the schema"

