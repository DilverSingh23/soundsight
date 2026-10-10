"""Server-side config loaded from environment / .env.

Secrets live here and nowhere else. Nothing in this module is ever sent to
the browser — see CLAUDE.md section 5.3 ("No API keys in the browser, ever").
"""

import os

from dotenv import load_dotenv

load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
ELEVENLABS_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5")

# Never expose the permanent credential to Next.js or return it from an API.
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")

# Browser origins allowed to request an ephemeral token during development.
SOUNDSIGHT_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "SOUNDSIGHT_ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
