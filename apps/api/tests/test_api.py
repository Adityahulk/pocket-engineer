import time

from fastapi.testclient import TestClient

from pocket_engineer.main import app
from pocket_engineer import main as main_module


def test_demo_task_completes_and_requires_approval():
    with TestClient(app) as client:
        projects = client.get("/v1/projects").json()
        demo = next(project for project in projects if project["is_demo"])
        response = client.post(
            f"/v1/projects/{demo['id']}/tasks",
            json={"mode": "fix", "goal": "Checkout returns 500 for customers without a discount. Fix it."},
        )
        assert response.status_code == 202
        task_id = response.json()["id"]

        deadline = time.time() + 10
        task = response.json()
        while time.time() < deadline and task["state"] not in {"ready_for_review", "failed"}:
            time.sleep(0.1)
            task = client.get(f"/v1/tasks/{task_id}").json()

        assert task["state"] == "ready_for_review", task.get("error")
        assert "discount_rate" in task["diff"]
        assert all(check["status"] == "passed" for check in task["verification"])

        blocked = client.post(f"/v1/tasks/{task_id}/pull-request")
        assert blocked.status_code == 409

        approved = client.post(f"/v1/tasks/{task_id}/approval", json={"decision": "approved"})
        assert approved.status_code == 200
        created = client.post(f"/v1/tasks/{task_id}/pull-request")
        assert created.status_code == 200
        assert created.json()["state"] == "completed"
        assert created.json()["pull_request_url"].endswith(task_id)


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
        assert body["projects"][0]["health_summary"]
        assert body["engineers"]

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
    assert captured["json"]["session"]["tools"][0]["name"] == "draft_mission"
    assert "Never say it has started" in captured["json"]["session"]["instructions"]


def test_readiness_and_auth_boundary(monkeypatch):
    with TestClient(app) as client:
        assert client.get("/health/ready").status_code == 200
        assert client.get("/v1/auth/config").json()["required"] is False

        monkeypatch.setattr(main_module.settings, "auth_mode", "supabase")
        monkeypatch.setattr(main_module.settings, "supabase_url", "https://example.supabase.co")
        assert client.get("/v1/projects").status_code == 401
        config = client.get("/v1/auth/config")
        assert config.status_code == 200
        assert config.json() == {"required": True, "provider": "supabase"}
