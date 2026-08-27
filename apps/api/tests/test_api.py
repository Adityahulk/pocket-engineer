import hashlib
import hmac
import json
import time

from fastapi.testclient import TestClient

from pocket_engineer.main import app
from pocket_engineer import main as main_module


def test_demo_task_completes_and_requires_approval():
    with TestClient(app) as client:
        projects = client.get("/v1/projects").json()
        demo = next(project for project in projects if project["is_demo"])
        assert demo["health_status"] == "incident"
        response = client.post(
            f"/v1/projects/{demo['id']}/tasks",
            json={"mode": "fix", "goal": "Checkout returns 500 for customers without a discount. Fix it."},
        )
        assert response.status_code == 202
        task_id = response.json()["id"]

        deadline = time.time() + 15
        task = response.json()
        while time.time() < deadline and task["state"] not in {"ready_for_review", "failed"}:
            time.sleep(0.1)
            task = client.get(f"/v1/tasks/{task_id}").json()

        assert task["state"] == "ready_for_review", task.get("error")
        assert task["engineer_name"] == "Alex"
        assert "discount_rate" in task["diff"]
        assert task["investigation"]["file_count"] >= 1
        assert all(check["status"] == "passed" for check in task["verification"])
        assert any(check.get("output") for check in task["verification"])

        blocked = client.post(f"/v1/tasks/{task_id}/pull-request")
        assert blocked.status_code == 409

        rejected = client.post(f"/v1/tasks/{task_id}/approval", json={"decision": "rejected", "feedback": "Need a smaller patch"})
        assert rejected.status_code == 200
        assert rejected.json()["state"] == "cancelled"
        assert rejected.json()["feedback"] == "Need a smaller patch"

        second = client.post(
            f"/v1/projects/{demo['id']}/tasks",
            json={"mode": "fix", "goal": "Checkout returns 500 for customers without a discount. Fix it."},
        )
        second_id = second.json()["id"]
        task = second.json()
        deadline = time.time() + 15
        while time.time() < deadline and task["state"] not in {"ready_for_review", "failed"}:
            time.sleep(0.1)
            task = client.get(f"/v1/tasks/{second_id}").json()
        assert task["state"] == "ready_for_review", task.get("error")
        approved = client.post(f"/v1/tasks/{second_id}/approval", json={"decision": "approved"})
        assert approved.status_code == 200
        created = client.post(f"/v1/tasks/{second_id}/pull-request")
        assert created.status_code == 200
        assert created.json()["state"] == "completed"
        assert created.json()["pull_request_url"].endswith(second_id)


def test_unknown_project_is_not_accepted():
    with TestClient(app) as client:
        response = client.post(
            "/v1/projects/not-found/tasks",
            json={"mode": "fix", "goal": "Fix the problem"},
        )
        assert response.status_code == 404


def test_command_center_and_voice_safety_contracts():
    with TestClient(app) as client:
        command_center = client.get("/v1/command-center")
        assert command_center.status_code == 200
        body = command_center.json()
        assert body["portfolio_health"] == "incident"
        assert body["incident_count"] >= 1
        assert body["engineer_name"] == "Alex"
        assert body["projects"][0]["health_summary"]
        assert body["engineers"]
        assert "pending_decisions" in body

        voice = client.post("/v1/voice/client-secret", json={})
        assert voice.status_code == 503
        assert "POCKET_OPENAI_API_KEY" in voice.json()["detail"]


def test_voice_client_secret_uses_server_key_and_safe_context(monkeypatch):
    captured = {}

    class FakeResponse:
        is_error = False

        def json(self):
            return {"value": "ek_test", "expires_at": 123}

    class FakeClient:
        def __init__(self, **kwargs):
            captured["client"] = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def post(self, path, **kwargs):
            captured.update({"path": path, **kwargs})
            return FakeResponse()

    monkeypatch.setattr(main_module.settings, "openai_api_key", "server-only-test-key")
    monkeypatch.setattr(main_module.httpx, "AsyncClient", FakeClient)
    with TestClient(app) as client:
        project = next(item for item in client.get("/v1/projects").json() if item["is_demo"])
        response = client.post("/v1/voice/client-secret", json={"project_id": project["id"]})
        assert response.status_code == 200
        assert response.json()["value"] == "ek_test"

    assert captured["path"] == "/v1/realtime/client_secrets"
    assert captured["headers"]["Authorization"] == "Bearer server-only-test-key"
    assert captured["headers"]["OpenAI-Safety-Identifier"]
    names = [tool["name"] for tool in captured["json"]["session"]["tools"]]
    assert names == ["get_status", "start_mission", "ship_mission", "reject_mission"]
    assert "start_mission" in captured["json"]["session"]["instructions"]
    assert "Never claim tests passed" in captured["json"]["session"]["instructions"]


def test_voice_can_start_a_mission():
    with TestClient(app) as client:
        project = next(item for item in client.get("/v1/projects").json() if item["is_demo"])
        started = client.post(
            "/v1/voice/tools",
            json={
                "name": "start_mission",
                "project_id": project["id"],
                "arguments": {
                    "goal": "Checkout returns 500 for customers without a discount. Fix it.",
                    "mode": "fix",
                    "autonomy": "assisted",
                },
            },
        )
        assert started.status_code == 200
        assert started.json()["started"] is True
        task_id = started.json()["mission"]["id"]
        deadline = time.time() + 15
        task = started.json()["mission"]
        while time.time() < deadline and task["state"] not in {"ready_for_review", "failed"}:
            time.sleep(0.1)
            task = client.get(f"/v1/tasks/{task_id}").json()
        assert task["state"] == "ready_for_review", task.get("error")
        shipped = client.post("/v1/voice/tools", json={"name": "ship_mission", "arguments": {"mission_id": task_id}})
        assert shipped.status_code == 200
        assert shipped.json()["mission"]["state"] == "completed"


def test_alert_webhook_updates_project_health(monkeypatch):
    monkeypatch.setattr(main_module.settings, "alert_webhook_token", "alert-secret")
    with TestClient(app) as client:
        project = next(item for item in client.get("/v1/projects").json() if item["is_demo"])
        response = client.post(
            "/v1/ingest/alerts",
            headers={"x-pocket-token": "alert-secret"},
            json={"project_id": project["id"], "summary": "Checkout 500s from Sentry", "severity": "error", "source": "sentry"},
        )
        assert response.status_code == 200
        assert response.json()["health_status"] == "incident"
        resolved = client.post(
            "/v1/ingest/alerts",
            headers={"x-pocket-token": "alert-secret"},
            json={"project_id": project["id"], "summary": "Checkout recovered", "resolved": True, "severity": "info"},
        )
        assert resolved.json()["health_status"] == "healthy"
        denied = client.post("/v1/ingest/alerts", json={"project_id": project["id"], "summary": "nope"})
        assert denied.status_code == 401


def test_github_webhook_signature(monkeypatch):
    secret = "hook-secret"
    monkeypatch.setattr(main_module.settings, "github_webhook_secret", secret)
    payload = {
        "repository": {"full_name": "local://demo-checkout"},
        "check_run": {"name": "tests", "conclusion": "failure"},
    }
    body = json.dumps(payload).encode()
    signature = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    with TestClient(app) as client:
        denied = client.post("/v1/github/webhooks", content=body, headers={"x-github-event": "check_run"})
        assert denied.status_code == 401
        accepted = client.post(
            "/v1/github/webhooks",
            content=body,
            headers={"x-github-event": "check_run", "x-hub-signature-256": signature, "content-type": "application/json"},
        )
        assert accepted.status_code == 200


def test_readiness_and_auth_boundary(monkeypatch):
    with TestClient(app) as client:
        assert client.get("/health/ready").status_code == 200
        assert client.get("/v1/auth/config").json()["required"] is False

        monkeypatch.setattr(main_module.settings, "auth_mode", "supabase")
        monkeypatch.setattr(main_module.settings, "supabase_url", "https://example.supabase.co")
        assert client.get("/v1/projects").status_code == 401
        config = client.get("/v1/auth/config")
        assert config.status_code == 200
        assert config.json() == {
            "required": True,
            "provider": "supabase",
            "supabase_url": "https://example.supabase.co",
            "supabase_publishable_key": "",
        }
