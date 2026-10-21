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
