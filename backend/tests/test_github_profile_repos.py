"""
Verifikasi portofolio dari URL profil GitHub (kasus #TK-A662A3).

Pelamar menempel `https://github.com/<user>`, bukan URL satu repo. Kode lama hanya menerima
bentuk `github.com/<owner>/<repo>` (4 garis miring) dan melewati profil tanpa pesan apa pun,
sehingga PORTFOLIO selalu 0 walau profilnya berisi banyak repo publik.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.adapters.github import GitHubAdapter
from app.core.scoring import DeterministicScoringEngine

PROFILE = "https://github.com/najmifaza"

REPOS_PAYLOAD = [
    {
        "name": "TalentOpsAI",
        "language": "JavaScript",
        "stargazers_count": 12,
        "forks_count": 3,
        "fork": False,
        "description": "AI recruitment agent",
        "default_branch": "main",
    },
    {
        "name": "template-lama",
        "language": "HTML",
        "stargazers_count": 0,
        "forks_count": 0,
        "fork": True,
        "description": "forked starter",
        "default_branch": "master",
    },
]


class _FakeResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload
        self.text = ""

    def json(self):
        return self._payload


class _FakeClient:
    def __init__(self, response=None, raises=None):
        self._response = response
        self._raises = raises
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, headers=None, params=None):
        self.calls.append({"url": url, "params": params})
        if self._raises:
            raise self._raises
        return self._response


def _patch_client(monkeypatch, client):
    monkeypatch.setattr("app.adapters.github.httpx.AsyncClient", lambda **kwargs: client)


def test_profile_url_is_recognised():
    adapter = GitHubAdapter(token=None)
    assert adapter.normalize_profile_url("https://github.com/najmifaza") == PROFILE
    assert adapter.normalize_profile_url("https://github.com/najmifaza/") == PROFILE
    assert adapter.normalize_profile_url("http://www.github.com/najmifaza") == PROFILE
    assert adapter.normalize_profile_url("github.com/najmifaza") == PROFILE


def test_repo_url_and_reserved_paths_are_not_profiles():
    adapter = GitHubAdapter(token=None)
    assert adapter.normalize_profile_url("https://github.com/najmifaza/TalentOpsAI") is None
    assert adapter.normalize_profile_url("https://github.com/orgs/nousresearch") is None
    assert adapter.normalize_profile_url("https://gitlab.com/najmifaza") is None
    assert adapter.normalize_profile_url(None) is None


@pytest.mark.asyncio
async def test_profile_listing_returns_every_public_repo(monkeypatch):
    client = _FakeClient(_FakeResponse(200, REPOS_PAYLOAD))
    _patch_client(monkeypatch, client)

    adapter = GitHubAdapter(token=None)
    result = await adapter.list_owner_repositories(PROFILE)

    assert result["profile"] == ["TalentOpsAI", "template-lama"]
    assert set(result["repos"]) == {
        "https://github.com/najmifaza/TalentOpsAI",
        "https://github.com/najmifaza/template-lama",
    }
    main_repo = result["repos"]["https://github.com/najmifaza/TalentOpsAI"]
    assert main_repo["primary_language"] == "JavaScript"
    assert main_repo["is_fork"] is False
    assert main_repo["stars_count"] == 12

    # Satu panggilan API saja: listing sudah membawa bahasa, bintang, dan status fork.
    assert len(client.calls) == 1
    assert client.calls[0]["url"].endswith("/users/najmifaza/repos")


@pytest.mark.asyncio
async def test_profile_repos_lift_portfolio_to_full_marks(monkeypatch):
    client = _FakeClient(_FakeResponse(200, REPOS_PAYLOAD))
    _patch_client(monkeypatch, client)

    adapter = GitHubAdapter(token=None)
    result = await adapter.list_owner_repositories(PROFILE)
    score = DeterministicScoringEngine.calculate_portfolio_score(
        result["repos"], is_programmer_role=True, portfolio_url=None
    )
    assert score == 100.0


@pytest.mark.asyncio
async def test_unknown_profile_is_reported_not_crashed(monkeypatch):
    _patch_client(monkeypatch, _FakeClient(_FakeResponse(404, {"message": "Not Found"})))

    result = await GitHubAdapter(token=None).list_owner_repositories(PROFILE)
    assert result["repos"] == {}
    assert result["summary"]["verified"] is False
    assert result["summary"]["reason"] == "GITHUB_PROFILE_NOT_FOUND"


@pytest.mark.asyncio
async def test_rate_limit_is_not_mistaken_for_a_fake_profile(monkeypatch):
    _patch_client(monkeypatch, _FakeClient(_FakeResponse(403, {"message": "rate limit"})))

    result = await GitHubAdapter(token=None).list_owner_repositories(PROFILE)
    assert result["summary"]["valid"] is True
    assert result["summary"]["verified"] is False
    assert result["summary"]["reason"] == "GITHUB_API_RATE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_network_error_degrades_gracefully(monkeypatch):
    _patch_client(monkeypatch, _FakeClient(raises=RuntimeError("dns down")))

    result = await GitHubAdapter(token=None).list_owner_repositories(PROFILE)
    assert result["repos"] == {}
    assert result["summary"]["reason"].startswith("NETWORK_ERROR_")


@pytest.mark.asyncio
async def test_profile_without_public_repos_still_scores_something(monkeypatch):
    _patch_client(monkeypatch, _FakeClient(_FakeResponse(200, [])))

    result = await GitHubAdapter(token=None).list_owner_repositories(PROFILE)
    assert result["repos"] == {}
    assert result["summary"]["verified"] is False
    assert result["summary"]["reason"] == "PROFILE_HAS_NO_PUBLIC_REPOSITORY"

    score = DeterministicScoringEngine.calculate_portfolio_score(
        {PROFILE: result["summary"]}, is_programmer_role=True, portfolio_url=None
    )
    assert score == 20.0, "URL valid tanpa repo harus dinilai seperti repo yang tidak ketemu"