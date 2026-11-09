import re
import httpx
from typing import Optional, Dict, Any
from app.core.config import settings

GITHUB_REPO_REGEX = re.compile(r"^https:\/\/github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)$")
# Applicants usually paste their profile, not one specific repository, so the profile URL is a
# first-class input: all public repositories on it are checked and the best one counts.
GITHUB_PROFILE_REGEX = re.compile(r"^https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)\/?$")
MAX_PROFILE_REPOS = 6

class GitHubAdapter:
    """
    Adapter for GitHub REST API v3.
    Verifies public repo existence, primary language, stars, forks, and ownership.
    Enforces SSRF prevention and rate-limit safety.
    """
    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.GITHUB_TOKEN
        self.base_url = "https://api.github.com"

    def parse_repo_url(self, url: str) -> Optional[tuple[str, str]]:
        if not url:
            return None
        match = GITHUB_REPO_REGEX.match(url.strip())
        if not match:
            return None
        owner, repo = match.groups()
        # Drop trailing .git if present
        if repo.endswith(".git"):
            repo = repo[:-4]
        return owner, repo

    @staticmethod
    def normalize_profile_url(url: Optional[str]) -> Optional[str]:
        """Returns `https://github.com/<owner>` for a profile URL, else None."""
        if not url or not isinstance(url, str):
            return None
        candidate = url.strip()
        if not candidate.lower().startswith(("http://", "https://")):
            # Applicants type "github.com/<user>" as often as the full URL.
            candidate = f"https://{candidate.lstrip('/')}"
        match = GITHUB_PROFILE_REGEX.match(candidate)
        if not match:
            return None
        owner = match.group(1)
        if owner.lower() in {"orgs", "topics", "search", "features", "about", "marketplace"}:
            return None
        return f"https://github.com/{owner}"

    async def list_owner_repositories(self, profile_url: str) -> Dict[str, Any]:
        """
        Verifies every public repository on a profile in ONE API call.

        The listing endpoint already carries language, star/fork counts and fork status, so
        per-repository lookups are unnecessary — that keeps the rate-limit cost at one request
        per candidate instead of one per repository.

        Returns {"profile": [...], "repos": {repo_url: audit}, "summary": audit_for_profile}.
        `repos` is empty when the profile has no public repository; `summary` still carries a
        verdict so the portfolio dimension scores it consistently with a dead repo URL.
        """
        owner_match = GITHUB_PROFILE_REGEX.match((profile_url or "").strip())
        if not owner_match:
            return {
                "profile": [],
                "repos": {},
                "summary": {"valid": False, "verified": False, "reason": "INVALID_GITHUB_URL_FORMAT",
                            "repo_url": profile_url},
            }

        owner = owner_match.group(1)
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "TalentOps-AI-Verification-Agent",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        api_url = f"{self.base_url}/users/{owner}/repos"
        params = {"per_page": MAX_PROFILE_REPOS, "sort": "pushed", "direction": "desc", "type": "owner"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(api_url, headers=headers, params=params)
                if resp.status_code != 200:
                    reason = {
                        404: "GITHUB_PROFILE_NOT_FOUND",
                        403: "GITHUB_API_RATE_LIMIT_EXCEEDED",
                    }.get(resp.status_code, f"HTTP_STATUS_{resp.status_code}")
                    return {
                        "profile": [],
                        "repos": {},
                        "summary": {"valid": resp.status_code == 403, "verified": False,
                                    "reason": reason, "repo_url": profile_url},
                    }
                payload = resp.json()
        except Exception as exc:
            return {
                "profile": [],
                "repos": {},
                "summary": {"valid": False, "verified": False,
                            "reason": f"NETWORK_ERROR_{type(exc).__name__}", "repo_url": profile_url},
            }

        repos: Dict[str, Any] = {}
        names = []
        for item in payload if isinstance(payload, list) else []:
            name = item.get("name")
            if not name:
                continue
            names.append(name)
            repo_url = f"https://github.com/{owner}/{name}"
            repos[repo_url] = {
                "valid": True,
                "verified": True,
                "owner": owner,
                "repo_name": name,
                "primary_language": item.get("language") or "Unknown",
                "stars_count": item.get("stargazers_count", 0),
                "forks_count": item.get("forks_count", 0),
                "is_fork": bool(item.get("fork", False)),
                "description": item.get("description") or "",
                "default_branch": item.get("default_branch", "main"),
                "source": "PROFILE_LISTING",
            }

        summary = {
            "valid": True,
            "verified": bool(repos),
            "owner": owner,
            "repo_count": len(repos),
            "repo_names": names,
            "repo_url": profile_url,
            "reason": None if repos else "PROFILE_HAS_NO_PUBLIC_REPOSITORY",
        }
        return {"profile": names, "repos": repos, "summary": summary}

    async def verify_repository(self, repo_url: str) -> Dict[str, Any]:
        """
        Validates GitHub repository URL via official REST API.
        Returns normalized verification dict.
        """
        parsed = self.parse_repo_url(repo_url)
        if not parsed:
            return {
                "valid": False,
                "reason": "INVALID_GITHUB_URL_FORMAT",
                "repo_url": repo_url,
                "verified": False,
            }

        owner, repo = parsed
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "TalentOps-AI-Verification-Agent",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        api_url = f"{self.base_url}/repos/{owner}/{repo}"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(api_url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "valid": True,
                        "verified": True,
                        "owner": owner,
                        "repo_name": repo,
                        "primary_language": data.get("language") or "Unknown",
                        "stars_count": data.get("stargazers_count", 0),
                        "forks_count": data.get("forks_count", 0),
                        "is_fork": data.get("fork", False),
                        "description": data.get("description") or "",
                        "default_branch": data.get("default_branch", "main"),
                    }
                elif resp.status_code == 404:
                    return {
                        "valid": False,
                        "verified": False,
                        "reason": "REPOSITORY_NOT_FOUND_OR_PRIVATE",
                        "repo_url": repo_url,
                    }
                elif resp.status_code == 403:
                    # Rate limit or forbidden
                    return {
                        "valid": True,  # URL syntactically valid
                        "verified": False,
                        "reason": "GITHUB_API_RATE_LIMIT_EXCEEDED",
                        "repo_url": repo_url,
                    }
                else:
                    return {
                        "valid": False,
                        "verified": False,
                        "reason": f"HTTP_STATUS_{resp.status_code}",
                        "repo_url": repo_url,
                    }
        except Exception as e:
            return {
                "valid": False,
                "verified": False,
                "reason": f"NETWORK_ERROR_{type(e).__name__}",
                "repo_url": repo_url,
            }

github_adapter = GitHubAdapter()
