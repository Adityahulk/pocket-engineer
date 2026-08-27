from fastapi import FastAPI
from fastapi.testclient import TestClient

from pocket_engineer.config import Settings
from pocket_engineer.webapp import mount_web_app, web_dist


def test_web_dist_uses_index_html(tmp_path):
    (tmp_path / "index.html").write_text("<html>mission control</html>")
    settings = Settings(web_root=str(tmp_path), _env_file=None)
    assert web_dist(settings) == tmp_path


def test_spa_serves_index_and_client_routes(tmp_path):
    (tmp_path / "index.html").write_text("<html>mission control</html>")
    (tmp_path / "asset.txt").write_text("ok")
    app = FastAPI()
    mount_web_app(app, tmp_path)
    with TestClient(app) as client:
        assert client.get("/").text == "<html>mission control</html>"
        assert client.get("/inbox").text == "<html>mission control</html>"
        assert client.get("/asset.txt").text == "ok"
        assert client.get("/v1/projects").status_code == 404
