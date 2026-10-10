"""Mint short-lived Deepgram access tokens without exposing the API key."""

import httpx
from fastapi import APIRouter, HTTPException, Response

from app.config import DEEPGRAM_API_KEY

router = APIRouter(prefix="/deepgram", tags=["deepgram"])
DEEPGRAM_GRANT_URL = "https://api.deepgram.com/v1/auth/grant"


@router.post("/token")
async def create_deepgram_token(response: Response) -> dict[str, str | int]:
    """Issue a short-lived JWT for a browser to open a Deepgram STT WebSocket.

    This development endpoint has no user authentication; secure and rate-limit
    it before exposing it to the public internet. CORS alone is not access control.
    """
    response.headers["Cache-Control"] = "no-store"
    if not DEEPGRAM_API_KEY:
        raise HTTPException(status_code=503, detail="Deepgram is not configured.")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            upstream = await client.post(
                DEEPGRAM_GRANT_URL,
                headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"},
            )
            upstream.raise_for_status()
            payload = upstream.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=502, detail="Failed to obtain a Deepgram access token."
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="Invalid Deepgram token response.")
    token = payload.get("access_token")
    expires_in = payload.get("expires_in")
    if not isinstance(token, str) or not token or type(expires_in) is not int or expires_in <= 0:
        raise HTTPException(status_code=502, detail="Invalid Deepgram token response.")
    return {"access_token": token, "expires_in": expires_in}
