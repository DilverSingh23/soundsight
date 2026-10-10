from fastapi.testclient import TestClient

from app.main import app


def test_ping_and_reconnect():
    with TestClient(app) as client:
        for _ in range(2):
            with client.websocket_connect("/ws/listen") as websocket:
                for _ in range(2):
                    websocket.send_json({"type": "ping"})
                    assert websocket.receive_json() == {"type": "pong"}


def test_invalid_messages_do_not_end_connection():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/listen") as websocket:
            for message in ["not json", "[]", '{"type":"unknown"}']:
                websocket.send_text(message)
                assert websocket.receive_json()["type"] == "error"
            websocket.send_json({"type": "ping"})
            assert websocket.receive_json() == {"type": "pong"}


def start_audio(websocket):
    websocket.send_json({"type": "start", "encoding": "pcm_s16le", "sample_rate": 16000, "channels": 1})
    assert websocket.receive_json() == {"type": "ready"}
    assert websocket.receive_json()["type"] == "classification_status"


def test_pcm_levels_and_counters_reset_on_reconnect():
    import struct

    with TestClient(app) as client:
        for _ in range(2):
            with client.websocket_connect("/ws/listen") as websocket:
                start_audio(websocket)
                for _ in range(5):
                    websocket.send_bytes(struct.pack("<1600h", *([16384] * 1600)))
                stats = websocket.receive_json()
                assert stats == {
                    "type": "audio_stats", "chunks": 5, "bytes": 16000,
                    "duration_seconds": 0.5, "rms": 0.5, "peak": 0.5,
                }
                for _ in range(5):
                    websocket.send_bytes(bytes(3200))
                silent = websocket.receive_json()
                assert silent["rms"] == silent["peak"] == 0
                assert silent["chunks"] == 10
                assert silent["duration_seconds"] == 1


def test_audio_requires_valid_format_and_chunks():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/listen") as websocket:
            websocket.send_bytes(bytes(3200))
            assert websocket.receive_json()["type"] == "error"
            websocket.send_json({"type": "start", "encoding": "pcm_s16le", "sample_rate": 48000, "channels": 1})
            assert websocket.receive_json()["type"] == "error"
            start_audio(websocket)
            for invalid in [b"", b"\x00", bytes(32002)]:
                websocket.send_bytes(invalid)
                assert websocket.receive_json()["type"] == "error"
            websocket.send_json({"type": "start"})
            assert websocket.receive_json()["type"] == "error"
            websocket.send_bytes(bytes(16000))
            assert websocket.receive_json()["bytes"] == 16000


def test_concurrent_connections_have_separate_audio_counters():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/listen") as first:
            with client.websocket_connect("/ws/listen") as second:
                start_audio(first)
                start_audio(second)
                first.send_bytes(bytes(3200))
                second.send_bytes(bytes(16000))
                assert second.receive_json()["chunks"] == 1
                first.send_bytes(bytes(12800))
                assert first.receive_json()["chunks"] == 2
