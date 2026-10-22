"""Shared test config.

The periodic maintenance loops (app/core/maintenance.py) are started by the FastAPI
lifespan. Tests that enter the app context would otherwise leave a slot-cleaner task
ticking against the real database after the suite finishes, so disable it here.

Upload endpoints persist the original file (app/core/file_parser.py). Tests drive
them with fake bytes, so the storage dir is pointed at a temp folder — writing
`%PDF-1.4 fake` stubs into backend/storage/resumes polluted the real dossier store.
"""

import tempfile

from app.core.config import settings

settings.MAINTENANCE_ENABLED = False
settings.DEMO_PURGE_ENABLED = False
settings.RESUME_STORAGE_DIR = tempfile.mkdtemp(prefix="talentops_test_resumes_")
