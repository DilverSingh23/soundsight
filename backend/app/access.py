"""Small, single-host demo access gate; no accounts or database."""

from collections import deque
import re
import secrets
import time
from urllib.parse import urlsplit

from fastapi import HTTPException, Request, WebSocket

from app.config import SOUNDSIGHT_ACCESS_CODE, SOUNDSIGHT_ENV

REQUEST_WINDOW_SECONDS = 60
MAX_PAID_REQUESTS_PER_WINDOW = 30


def validate_deployment_config(origins: list[str]) -> None:
    if SOUNDSIGHT_ACCESS_CODE and not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", SOUNDSIGHT_ACCESS_CODE):
        raise RuntimeError("SOUNDSIGHT_ACCESS_CODE must be 32–128 URL-safe characters.")
    if SOUNDSIGHT_ENV == "production":
        if not SOUNDSIGHT_ACCESS_CODE:
            raise RuntimeError("Production requires SOUNDSIGHT_ACCESS_CODE.")
        def is_https_origin(origin: str) -> bool:
            parsed = urlsplit(origin)
            return parsed.scheme == "https" and bool(parsed.hostname) and not (
                parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment
            )
        if not origins or any(not is_https_origin(origin) for origin in origins):
            raise RuntimeError("Production requires exact HTTPS frontend origins.")


def code_matches(candidate: str) -> bool:
    return secrets.compare_digest(candidate.encode(), SOUNDSIGHT_ACCESS_CODE.encode())


async def require_demo_access(request: Request) -> None:
    if SOUNDSIGHT_ACCESS_CODE:
        scheme, _, credential = request.headers.get("authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not code_matches(credential):
            raise HTTPException(status_code=401, detail="Demo access code required.")
    # One shared budget per process bounds provider calls without retaining IPs.
    now = time.monotonic()
    requests: deque = request.app.state.paid_requests
    while requests and now - requests[0] >= REQUEST_WINDOW_SECONDS:
        requests.popleft()
    if len(requests) >= MAX_PAID_REQUESTS_PER_WINDOW:
        raise HTTPException(status_code=429, detail="Demo request limit reached. Try again shortly.", headers={"Retry-After": "60"})
    requests.append(now)


def websocket_access_allowed(websocket: WebSocket, origins: list[str]) -> bool:
    origin = websocket.headers.get("origin")
    # Non-browser capture clients can omit Origin but still need the access code.
    if origin is not None and origin not in origins:
        return False
    if not SOUNDSIGHT_ACCESS_CODE:
        return True
    protocols = websocket.scope.get("subprotocols", [])
    return "soundsight" in protocols and any(
        protocol.startswith("access.") and code_matches(protocol[7:])
        for protocol in protocols
    )
