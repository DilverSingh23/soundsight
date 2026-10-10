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
