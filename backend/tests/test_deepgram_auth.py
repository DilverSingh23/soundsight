"""Token endpoint tests never call Deepgram or use real credentials."""

from fastapi.testclient import TestClient

from app import deepgram_auth
from app.main import app


def test_deepgram_token_missing_key(monkeypatch):
    monkeypatch.setattr(deepgram_auth, "DEEPGRAM_API_KEY", "")
    with TestClient(app) as client:
        response = client.post("/deepgram/token")
    assert response.status_code == 503
    assert "access_token" not in response.text


def test_deepgram_token_success(monkeypatch):
    monkeypatch.setattr(deepgram_auth, "DEEPGRAM_API_KEY", "fake-key-not-secret")

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"access_token": "fake-ephemeral-token", "expires_in": 30}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, headers):
            assert url == deepgram_auth.DEEPGRAM_GRANT_URL
            assert headers == {"Authorization": "Token fake-key-not-secret"}
            return FakeResponse()

    monkeypatch.setattr(deepgram_auth.httpx, "AsyncClient", lambda **_kwargs: FakeClient())
    with TestClient(app) as client:
        response = client.post("/deepgram/token")
    assert response.status_code == 200
    assert response.json() == {"access_token": "fake-ephemeral-token", "expires_in": 30}
    assert response.headers["cache-control"] == "no-store"


def test_deepgram_token_bad_response(monkeypatch):
    monkeypatch.setattr(deepgram_auth, "DEEPGRAM_API_KEY", "fake-key-not-secret")

    class BadResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"wrong": "shape"}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            return BadResponse()

    monkeypatch.setattr(deepgram_auth.httpx, "AsyncClient", lambda **_kwargs: FakeClient())
    with TestClient(app) as client:
        response = client.post("/deepgram/token")
    assert response.status_code == 502


def test_deepgram_token_upstream_failure(monkeypatch):
    import httpx

    monkeypatch.setattr(deepgram_auth, "DEEPGRAM_API_KEY", "fake-key-not-secret")

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            raise httpx.ConnectError("Connection refused to provider")

    monkeypatch.setattr(deepgram_auth.httpx, "AsyncClient", lambda **_kwargs: FakeClient())
    with TestClient(app) as client:
        response = client.post("/deepgram/token")
    assert response.status_code == 502
    assert "fake-key-not-secret" not in response.text
    assert "Connection refused" not in response.text


def test_deepgram_token_rejects_expired_token(monkeypatch):
    monkeypatch.setattr(deepgram_auth, "DEEPGRAM_API_KEY", "fake-key")

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"access_token": "fake-token", "expires_in": 0}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            return FakeResponse()

    monkeypatch.setattr(deepgram_auth.httpx, "AsyncClient", lambda **_kwargs: FakeClient())
    with TestClient(app) as client:
        response = client.post("/deepgram/token")
    assert response.status_code == 502


def test_cors_allows_local_frontend_and_rejects_other_origins():
    with TestClient(app) as client:
        allowed = client.options(
            "/deepgram/token",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"

        blocked = client.options(
            "/deepgram/token",
            headers={
                "Origin": "https://untrusted.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert blocked.status_code == 400
        assert "access-control-allow-origin" not in blocked.headers
