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

# The frontend origin allowed to call this backend's HTTP endpoints (CORS).
# Must match the browser's Origin header exactly, including scheme and port.
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
