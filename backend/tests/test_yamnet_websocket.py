from fastapi.testclient import TestClient
from app.audio.windows import WINDOW_SAMPLES
import app.main as main


def test_websocket_classification_timestamps(monkeypatch):
    received = []
    class FakeModel:
        def __init__(self, _directory):
            pass
        def classify(self, pcm):
            received.append(pcm)
            return [{"category": "dog", "subtype": "bark", "score": 0.8, "raw_class": "Bark"}]
    monkeypatch.setenv("YAMNET_MODEL_DIR", "test-model")
    monkeypatch.setattr(main, "YamnetClassifier", FakeModel)
    with TestClient(main.app) as client:
        with client.websocket_connect("/ws/listen") as socket:
            socket.send_json({"type": "start", "encoding": "pcm_s16le", "sample_rate": 16000, "channels": 1})
            assert socket.receive_json()["type"] == "ready"
            assert socket.receive_json()["state"] == "ready"
            socket.send_bytes(bytes(WINDOW_SAMPLES * 2))
            events = [socket.receive_json(), socket.receive_json()]
            event = next(item for item in events if item["type"] == "classification")
            assert (event["window_start"], event["window_end"]) == (0, 0.975)
            assert len(received[0]) == WINDOW_SAMPLES * 2


def test_load_failure_keeps_audio_reception(monkeypatch):
    def broken(_directory):
        raise RuntimeError("Missing model")
    monkeypatch.setenv("YAMNET_MODEL_DIR", "bad-model")
    monkeypatch.setattr(main, "YamnetClassifier", broken)
    with TestClient(main.app) as client:
        with client.websocket_connect("/ws/listen") as socket:
            socket.send_json({"type": "start", "encoding": "pcm_s16le", "sample_rate": 16000, "channels": 1})
            assert socket.receive_json()["type"] == "ready"
            assert socket.receive_json()["state"] == "error"
            socket.send_bytes(bytes(16000))
            assert socket.receive_json()["type"] == "audio_stats"


def test_filtered_events_use_session_cooldowns_and_skip_speech(monkeypatch):
    class FakeModel:
        def __init__(self, _directory):
            pass

        def classify(self, pcm):
            return [
                {"category": "speech", "subtype": "general", "score": 0.99},
                {"category": "doorbell", "subtype": "general", "score": 0.8},
                {"category": "dog", "subtype": "bark", "score": 0.1},
            ]

    monkeypatch.setenv("YAMNET_MODEL_DIR", "test-model")
    monkeypatch.setattr(main, "YamnetClassifier", FakeModel)
    with TestClient(main.app) as client:
        for _ in range(2):
            with client.websocket_connect("/ws/listen") as socket:
                socket.send_json({"type": "start", "encoding": "pcm_s16le", "sample_rate": 16000, "channels": 1})
                assert socket.receive_json()["type"] == "ready"
                assert socket.receive_json()["state"] == "ready"
                socket.send_bytes(bytes(WINDOW_SAMPLES * 2))
                events = [socket.receive_json() for _ in range(3)]
                approved = [event for event in events if event["type"] == "sound_event"]
                assert len(approved) == 1
                assert approved[0]["category"] == "doorbell"
                assert approved[0]["audio_time"] == 0.975
                # Next overlapping window remains in the same cooldown.
                socket.send_bytes(bytes(7680 * 2))
                assert socket.receive_json()["type"] == "classification"
                socket.send_json({"type": "ping"})
                assert socket.receive_json() == {"type": "pong"}
