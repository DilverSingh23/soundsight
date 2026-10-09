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
