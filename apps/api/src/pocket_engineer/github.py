from __future__ import annotations

import time
from pathlib import Path

import httpx
import jwt

from .config import Settings


class GitHubError(RuntimeError):
    pass


class GitHubService:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def installation_url(self) -> str | None:
        if not self.settings.github_app_slug:
            return None
        return f"https://github.com/apps/{self.settings.github_app_slug}/installations/new"

    async def installation_token(self, installation_id: int | None) -> str | None:
        if self.settings.github_token:
            return self.settings.github_token
        if not installation_id or not self.settings.github_app_id or not self.settings.github_private_key:
            return None
        private_key = self.settings.github_private_key
        key_path = Path(private_key)
        if "BEGIN" not in private_key and key_path.exists():
            private_key = key_path.read_text()
        now = int(time.time())
        app_jwt = jwt.encode(
            {"iat": now - 60, "exp": now + 540, "iss": self.settings.github_app_id},
            private_key,
            algorithm="RS256",
        )
        async with httpx.AsyncClient(base_url=self.settings.github_api_url, timeout=30) as client:
            response = await client.post(
                f"/app/installations/{installation_id}/access_tokens",
                headers={
                    "Authorization": f"Bearer {app_jwt}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
        if response.is_error:
            raise GitHubError(f"GitHub token request failed: {response.status_code} {response.text[:500]}")
        return response.json()["token"]

    async def create_pull_request(
        self,
        repo_full_name: str,
        token: str,
        branch: str,
        default_branch: str,
        title: str,
        body: str,
    ) -> str:
        async with httpx.AsyncClient(base_url=self.settings.github_api_url, timeout=30) as client:
            response = await client.post(
                f"/repos/{repo_full_name}/pulls",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                json={"title": title, "head": branch, "base": default_branch, "body": body},
            )
        if response.is_error:
            raise GitHubError(f"GitHub PR request failed: {response.status_code} {response.text[:1000]}")
        return response.json()["html_url"]

    async def list_installation_repositories(self, installation_id: int) -> list[dict]:
        token = await self.installation_token(installation_id)
        if not token:
            raise GitHubError("GitHub App credentials are not configured")
        async with httpx.AsyncClient(base_url=self.settings.github_api_url, timeout=30) as client:
            response = await client.get(
                "/installation/repositories",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                params={"per_page": 100},
            )
        if response.is_error:
            raise GitHubError(f"GitHub repository request failed: {response.status_code} {response.text[:1000]}")
        return [
            {
                "full_name": repo["full_name"],
                "clone_url": repo["clone_url"],
                "default_branch": repo["default_branch"],
                "private": repo["private"],
            }
            for repo in response.json().get("repositories", [])
        ]
