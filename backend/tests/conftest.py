"""Shared test config.

The periodic maintenance loops (app/core/maintenance.py) are started by the FastAPI
lifespan. Tests that enter the app context would otherwise leave a slot-cleaner task
ticking against the real database after the suite finishes, so disable it here.
"""

from app.core.config import settings

settings.MAINTENANCE_ENABLED = False
settings.DEMO_PURGE_ENABLED = False
