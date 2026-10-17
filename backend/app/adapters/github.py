import re
import httpx
from typing import Optional, Dict, Any
from app.core.config import settings

GITHUB_REPO_REGEX = re.compile(r"^https:\/\/github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)$")

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
