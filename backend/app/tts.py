"""Type-to-speak: text in, ElevenLabs audio out.

The browser never sees an API key — it POSTs text here, we call ElevenLabs
server-side with the real key, and stream the audio back. See CLAUDE.md
section 5.3 and section 10 (ElevenLabs latency / speechSynthesis fallback
is a frontend concern; this endpoint just needs to fail fast and clearly
so that fallback has something to trigger on).

Model/voice defaults: eleven_flash_v2_5 is ElevenLabs' current low-latency
model (~75ms median inference per their docs, Oct 2026) — verified against
https://elevenlabs.io/docs/overview/models rather than assumed from memory.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from elevenlabs import AsyncElevenLabs, VoiceSettings
from elevenlabs.core.api_error import ApiError

from app.config import ELEVENLABS_API_KEY, ELEVENLABS_MODEL_ID, ELEVENLABS_VOICE_ID

router = APIRouter(prefix="/tts", tags=["tts"])

# TTS_OUTPUT_FORMAT is an ElevenLabs enum string, not a magic number: mp3 at
# 44.1kHz/128kbps, a reasonable default for browser <audio> playback.
TTS_OUTPUT_FORMAT = "mp3_44100_128"

# Matches the speaking-rate range the frontend already exposes in Settings
# (frontend/lib/preferences.ts), confirmed against the installed SDK's
# VoiceSettings.speed field rather than assumed.
SPEED_MIN = 0.7
SPEED_MAX = 1.3


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    speed: float | None = Field(None, ge=SPEED_MIN, le=SPEED_MAX)


# Builds an ElevenLabs client, or fails fast with a clear 500 if no API key is configured.
def _get_client() -> AsyncElevenLabs:
    if not ELEVENLABS_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ELEVENLABS_API_KEY is not set on the backend (see .env.example).",
        )
    return AsyncElevenLabs(api_key=ELEVENLABS_API_KEY)


# Streams ElevenLabs audio for the given text back to the caller as an mp3 response.
@router.post("/speak")
async def speak(request: SpeakRequest) -> StreamingResponse:
    client = _get_client()

    # client.text_to_speech.stream(...) is an async generator function: calling it
    # returns the generator immediately without making the HTTP request. The request
    # only fires on the first __anext__, so we pull that chunk here, inside the
    # try/except, to catch auth/ApiError before any response bytes reach the caller.
    audio_stream = client.text_to_speech.stream(
        voice_id=ELEVENLABS_VOICE_ID,
        text=request.text,
        model_id=ELEVENLABS_MODEL_ID,
        output_format=TTS_OUTPUT_FORMAT,
        voice_settings=VoiceSettings(speed=request.speed) if request.speed else None,
    )
    try:
        first_chunk = await audio_stream.__anext__()
    except StopAsyncIteration:
        raise HTTPException(status_code=502, detail="ElevenLabs returned no audio.")
    except ApiError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"ElevenLabs request failed (status {exc.status_code}).",
        ) from exc

    async def audio_chunks():
        yield first_chunk
        async for chunk in audio_stream:
            yield chunk

    return StreamingResponse(audio_chunks(), media_type="audio/mpeg")
