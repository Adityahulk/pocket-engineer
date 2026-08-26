from pocket_engineer.investigate import investigate
from pocket_engineer.sandbox import sanitized_env


def test_sanitized_env_drops_host_secrets(monkeypatch):
    monkeypatch.setenv("POCKET_GITHUB_TOKEN", "secret-token")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "aws")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    env = sanitized_env()
    assert "POCKET_GITHUB_TOKEN" not in env
    assert "AWS_SECRET_ACCESS_KEY" not in env
    assert "OPENAI_API_KEY" not in env
    assert sanitized_env(include_model_keys=True)["OPENAI_API_KEY"] == "sk-test"


def test_investigate_finds_checkout_evidence():
    from pocket_engineer.config import Settings

    workspace = Settings().resolve_from_api("fixtures/demo-checkout")
    result = investigate(workspace, "Checkout returns 500 for customers without a discount")
    assert result["file_count"] >= 1
    assert any("checkout.py" in path for path in result["files"])
    assert result["hits"]
