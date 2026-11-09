"""Shared test config.

The periodic maintenance loops (app/core/maintenance.py) are started by the FastAPI
lifespan. Tests that enter the app context would otherwise leave a slot-cleaner task
ticking against the real database after the suite finishes, so disable it here.

Upload endpoints persist the original file (app/core/file_parser.py). Tests drive
them with fake bytes, so the storage dir is pointed at a temp folder — writing
`%PDF-1.4 fake` stubs into backend/storage/resumes polluted the real dossier store.
"""

import tempfile

import pytest

from app.core.config import settings
from app.core.llm_adapter import reset_llm_circuit_breaker

settings.MAINTENANCE_ENABLED = False
settings.DEMO_PURGE_ENABLED = False
settings.RESUME_STORAGE_DIR = tempfile.mkdtemp(prefix="talentops_test_resumes_")

# AI feature flags (docs/RENCANA_PENGEMBANGAN_AI.md). Off by default so no test blocks
# on a gateway that is not running; each feature has its own test that turns it on and
# injects a fake adapter.
settings.DUAL_MODEL_VERIFY = False
settings.MODERATION_LLM_ENABLED = False
settings.BIAS_LLM_ANALYSIS = False


@pytest.fixture(autouse=True)
def _clean_llm_circuit_breaker():
    """The auth circuit breaker is process-wide; leaking state between tests would make
    "quarantined" depend on test order."""
    reset_llm_circuit_breaker()
    yield
    reset_llm_circuit_breaker()
