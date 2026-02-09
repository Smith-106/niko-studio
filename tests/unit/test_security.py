
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from src.web.app import app

def test_websocket_cs_wsh_protection():
    """
    Test that the WebSocket endpoint rejects connections from untrusted origins.
    """
    client = TestClient(app)

    # Simulate a malicious origin
    # This should now FAIL to connect (raise WebSocketDisconnect or 403)
    try:
        with client.websocket_connect("/ws/test_client", headers={"Origin": "http://evil.com"}) as websocket:
            pytest.fail("Connection from evil.com should have been rejected")
    except (WebSocketDisconnect, Exception) as e:
        # Expected behavior: connection closed or rejected
        pass

def test_websocket_normal_connection():
    """
    Test that the WebSocket endpoint accepts connections from trusted origins.
    """
    client = TestClient(app)
    # Assuming localhost:8000 is trusted
    # Note: TestClient default base_url is http://testserver
    # We might need to adjust allowed origins to include http://testserver or pass correct headers

    # Let's use http://localhost:8000 as origin which we will whitelist
    with client.websocket_connect("/ws/test_client", headers={"Origin": "http://localhost:8000"}) as websocket:
        pass
