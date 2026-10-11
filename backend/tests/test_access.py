from collections import deque

from fastapi.testclient import TestClient
import pytest
from starlette.websockets import WebSocketDisconnect

from app import access
from app.main import app

CODE = "a" * 64


@pytest.mark.parametrize("path", ["/deepgram/token", "/tts/speak"])
def test_paid_endpoints_reject_missing_and_wrong_code(monkeypatch, path):
    monkeypatch.setattr(access, "SOUNDSIGHT_ACCESS_CODE", CODE)
    with TestClient(app) as client:
        assert client.post(path, json={"text": "hello"}).status_code == 401
        assert client.post(path, json={"text": "hello"}, headers={"Authorization": "Bearer wrong"}).status_code == 401
        assert not app.state.paid_requests


def test_valid_code_reaches_provider_configuration_check(monkeypatch):
    from app import deepgram_auth
    monkeypatch.setattr(access, "SOUNDSIGHT_ACCESS_CODE", CODE)
    monkeypatch.setattr(deepgram_auth, "DEEPGRAM_API_KEY", "")
    with TestClient(app) as client:
        response = client.post("/deepgram/token", headers={"Authorization": f"Bearer {CODE}"})
        assert response.status_code == 503
        assert len(app.state.paid_requests) == 1


def test_provider_budget_rejects_and_expires(monkeypatch):
    from app import deepgram_auth
    monkeypatch.setattr(deepgram_auth, "DEEPGRAM_API_KEY", "")
    with TestClient(app) as client:
        now = access.time.monotonic()
        app.state.paid_requests = deque([now] * access.MAX_PAID_REQUESTS_PER_WINDOW)
        response = client.post("/deepgram/token")
        assert response.status_code == 429
        assert response.headers["retry-after"] == "60"
        app.state.paid_requests = deque([now - access.REQUEST_WINDOW_SECONDS - 1])
        assert client.post("/deepgram/token").status_code == 503


def test_websocket_requires_code_and_accepts_valid_subprotocol(monkeypatch):
    monkeypatch.setattr(access, "SOUNDSIGHT_ACCESS_CODE", CODE)
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/listen"):
                pass
        with client.websocket_connect("/ws/listen", subprotocols=["soundsight", f"access.{CODE}"]) as ws:
            assert ws.accepted_subprotocol == "soundsight"
            ws.send_json({"type": "ping"})
            assert ws.receive_json() == {"type": "pong"}


def test_websocket_rejects_untrusted_origin():
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/listen", headers={"Origin": "https://untrusted.example"}):
                pass


def test_production_requires_code_and_https_origins(monkeypatch):
    monkeypatch.setattr(access, "SOUNDSIGHT_ENV", "production")
    monkeypatch.setattr(access, "SOUNDSIGHT_ACCESS_CODE", "")
    with pytest.raises(RuntimeError, match="requires SOUNDSIGHT_ACCESS_CODE"):
        access.validate_deployment_config(["https://soundsight.example"])
    monkeypatch.setattr(access, "SOUNDSIGHT_ACCESS_CODE", CODE)
    with pytest.raises(RuntimeError, match="HTTPS"):
        access.validate_deployment_config(["http://localhost:3000"])
    with pytest.raises(RuntimeError, match="HTTPS"):
        access.validate_deployment_config(["https://soundsight.example/settings"])
    access.validate_deployment_config(["https://soundsight.example"])
