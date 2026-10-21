r"""
CORS origin allow-list.

The API is called from the Vercel-hosted frontend, so a domain move silently breaks
every browser request if the allow-list is not updated. The regex is also checked
against lookalike domains: adding `ai.id` naively to the previous pattern
(`^https://.*(vercel\.app|fawt\.biz\.id)$`) would have accepted `https://evil-ai.id`.

The list assertion reads the class default rather than `settings.CORS_ORIGINS`,
because a local `.env` may override the value and hide a wrong default.
"""
import re
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from app.core.config import Settings
from app.main import app

CORS_REGEX = next(
    m.kwargs["allow_origin_regex"]
    for m in app.user_middleware
    if m.cls.__name__ == "CORSMiddleware"
)
DEFAULT_ORIGINS = Settings.model_fields["CORS_ORIGINS"].default


def test_production_frontend_origins_are_in_the_default_list():
    """The custom domain and its www variant must survive a fresh checkout (no .env)."""
    assert "https://talentops.ai.id" in DEFAULT_ORIGINS
    assert "https://www.talentops.ai.id" in DEFAULT_ORIGINS


def test_production_frontend_origins_pass_the_regex():
    """A local .env that omits the new domain must still be rescued by the regex."""
    for origin in ("https://talentops.ai.id", "https://www.talentops.ai.id"):
        assert re.match(CORS_REGEX, origin), f"{origin} rejected by allow_origin_regex"


def test_legacy_and_api_origins_still_allowed():
    """The API domain and the old frontend stay reachable during the DNS cutover."""
    for origin in (
        "https://talentops.fawt.biz.id",
        "https://api-talentops.fawt.biz.id",
        "https://talentops-preview.vercel.app",
    ):
        assert re.match(CORS_REGEX, origin), f"{origin} rejected by allow_origin_regex"


def test_lookalike_domains_are_rejected():
    """Adding ai.id must not open the API to every domain that ends in those letters."""
    for origin in (
        "https://evil-ai.id",
        "https://notai.id",
        "https://talentops.ai.id.evil.com",
        "http://talentops.ai.id",
        "https://evil-fawt.biz.id",
    ):
        assert not re.match(CORS_REGEX, origin), f"{origin} unexpectedly allowed"
