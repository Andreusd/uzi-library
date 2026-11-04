import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server.main import app
from server.deps import get_ai_mgr
from server.ai.manager import AIManager
from server.ai.providers import DummyProvider

@pytest.fixture
def dummy_ai_client():
    mgr = AIManager(provider=DummyProvider())
    app.dependency_overrides[get_ai_mgr] = lambda: mgr
    client = TestClient(app)
    yield client
    app.dependency_overrides.pop(get_ai_mgr, None)

def test_ai_status(dummy_ai_client):
    res = dummy_ai_client.get("/api/ai/status")
    assert res.status_code == 200
    data = res.json()
    assert data["available"] is True
    assert "engine" in data

def test_ai_message(dummy_ai_client):
    payload = {
        "messages": [{"role": "user", "content": "O que significa este parágrafo?"}],
        "book_title": "O Príncipe",
        "book_author": "Nicolau Maquiavel",
        "location": "Capítulo 1",
        "contexts": [
            {"text": "Todos os Estados, todos os domínios que tiveram e têm autoridade sobre os homens...", "location": "Pág. 5"}
        ]
    }
    res = dummy_ai_client.post("/api/ai/message", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "assistente de leitura com IA" in data["reply"]

def test_ai_chat_streaming(dummy_ai_client):
    payload = {
        "messages": [{"role": "user", "content": "Explique o conceito de virtù"}],
        "contexts": [{"text": "A fortuna é mulher...", "location": "Cap. 25"}]
    }
    res = dummy_ai_client.post("/api/ai/chat", json=payload)
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    text = res.text
    assert "data: " in text
    assert '"done": true' in text

def test_ai_empty_messages(dummy_ai_client):
    res = dummy_ai_client.post("/api/ai/message", json={"messages": []})
    assert res.status_code == 400
