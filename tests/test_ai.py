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

def test_ai_settings_endpoint_get_and_post(dummy_ai_client):
    from server.database import get_db
    db = get_db()
    # Preserve original live settings so tests never wipe user's key
    orig_key = db.get_setting("gemini_api_key")
    orig_model = db.get_setting("gemini_model")
    try:
        # GET initial
        res = dummy_ai_client.get("/api/ai/settings")
        assert res.status_code == 200
        data = res.json()
        assert "has_api_key" in data
        assert "model" in data

        # POST set key
        res = dummy_ai_client.post("/api/ai/settings", json={"api_key": "AIzaSyTestKey1234567890", "model": "gemini-3.5-flash"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["has_api_key"] is True
        assert data["api_key_masked"] == "...7890"
        # Verify that get_setting returns the decrypted plaintext
        assert db.get_setting("gemini_api_key") == "AIzaSyTestKey1234567890"

        # Verify that the raw SQLite row is physically ENCRYPTED at rest
        with db.get_connection() as conn:
            raw_val = conn.execute("SELECT value FROM settings WHERE key = 'gemini_api_key'").fetchone()["value"]
            assert raw_val.startswith("enc:v1:")
            assert "AIzaSyTestKey" not in raw_val
    finally:
        # Restore live settings
        db.set_setting("gemini_api_key", orig_key or "")
        db.set_setting("gemini_model", orig_model or "gemini-3.5-flash")


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


@pytest.mark.anyio
async def test_gemini_provider_availability():
    from server.ai.providers import GeminiProvider
    p_no_key = GeminiProvider(api_key="")
    assert await p_no_key.is_available() is False

    p_with_key = GeminiProvider(api_key="test-key-123")
    assert await p_with_key.is_available() is True
    assert p_with_key.engine_name == "gemini_flash"


@pytest.mark.anyio
async def test_gemini_provider_streaming_mock(monkeypatch):
    from server.ai.providers import GeminiProvider
    import httpx

    fake_sse_lines = [
        b'data: {"candidates": [{"content": {"parts": [{"text": "Ol\xc3\xa1! "}]}}]}\n\n',
        b'data: {"candidates": [{"content": {"parts": [{"text": "Sou o Gemini Flash."}]}}]}\n\n'
    ]

    class FakeResponse:
        status_code = 200

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def aiter_lines(self):
            for line in fake_sse_lines:
                yield line.decode("utf-8")

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        def stream(self, method, url, json=None):
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)

    provider = GeminiProvider(api_key="valid-mock-key")
    chunks = []
    async for chunk in provider.stream_chat(prompt="Olá"):
        chunks.append(chunk)

    assert "".join(chunks) == "Olá! Sou o Gemini Flash."


def test_manager_provider_resolution(monkeypatch):
    from server.ai.manager import get_default_provider
    from server.ai.providers import GeminiProvider, DummyProvider

    # With GEMINI_API_KEY set
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-xyz")
    monkeypatch.delenv("UZI_AI_PROVIDER", raising=False)
    p = get_default_provider()
    assert isinstance(p, GeminiProvider)
    assert p.api_key == "test-key-xyz"

    # With UZI_AI_PROVIDER=dummy
    monkeypatch.setenv("UZI_AI_PROVIDER", "dummy")
    p2 = get_default_provider()
    assert isinstance(p2, DummyProvider)


def test_multiturn_messages_formatting():
    from server.ai.manager import AIManager, DEFAULT_SYSTEM_PROMPT
    from server.ai.providers import GeminiProvider, DummyProvider

    # Verify anti-spoiler and sidebar directive in prompt
    assert "ANTI-SPOILER RULE" in DEFAULT_SYSTEM_PROMPT
    assert "SIDEBAR / SKIMMABLE FORMAT" in DEFAULT_SYSTEM_PROMPT
    assert "LANGUAGE MATCHING" in DEFAULT_SYSTEM_PROMPT

    mgr = AIManager(provider=DummyProvider())
    messages = [
        {"role": "user", "content": "Quem é o narrador?"},
        {"role": "assistant", "content": "O narrador é Bento Santiago (Dom Casmurro)."},
        {"role": "user", "content": "E quem é Capitu?"}
    ]
    multiturn = mgr.build_multiturn_messages(
        messages=messages,
        book_title="Dom Casmurro",
        book_author="Machado de Assis",
        location="Capítulo 3",
        contexts=[{"text": "Capitu tinha olhos de cigana oblíqua e dissimulada.", "location": "Cap. 3"}]
    )

    assert len(multiturn) == 3
    assert "Dom Casmurro" in multiturn[0]["content"]
    assert multiturn[1]["role"] == "assistant"
    assert multiturn[1]["content"] == "O narrador é Bento Santiago (Dom Casmurro)."
    # The last user turn should contain the active selection and the latest query
    assert "olhos de cigana" in multiturn[2]["content"]
    assert "E quem é Capitu?" in multiturn[2]["content"]

    # Verify Gemini provider formatting alternates turns and maps roles
    contents = GeminiProvider._format_gemini_contents(multiturn)
    assert len(contents) == 3
    assert contents[0]["role"] == "user"
    assert contents[1]["role"] == "model"
    assert contents[2]["role"] == "user"

@pytest.mark.anyio
async def test_gemini_provider_tool_execution_loop(monkeypatch):
    from server.ai.providers import GeminiProvider
    import httpx

    # Simulate 2-round conversation:
    # Round 1: Model invokes `search_book`
    # Round 2: Model returns final grounded answer after receiving functionResponse
    call_history = []

    class FakeResponseRound1:
        status_code = 200
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        async def aiter_lines(self):
            chunk = (
                'data: {"candidates": [{"content": {"parts": [{'
                '"functionCall": {"name": "search_book", "args": {"query": "Capitu"}},'
                '"thoughtSignature": "thought_sig_123"'
                '}]}}]}\n\n'
            )
            yield chunk

    class FakeResponseRound2:
        status_code = 200
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        async def aiter_lines(self):
            chunk = 'data: {"candidates": [{"content": {"parts": [{"text": "Capitu já foi mencionada no Capítulo 2."}]}}]}\n\n'
            yield chunk

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        def stream(self, method, url, json=None):
            call_history.append(json)
            if len(call_history) == 1:
                return FakeResponseRound1()
            return FakeResponseRound2()

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)

    tool_called = []
    async def fake_tool_executor(name: str, args: dict):
        tool_called.append((name, args))
        return {"results": [{"chapter": "Capítulo 2", "snippet": "...Capitu estava na janela..."}], "count": 1}

    provider = GeminiProvider(api_key="valid-mock-key")
    chunks = []
    async for chunk in provider.stream_chat(
        prompt="Esta é a primeira aparição de Capitu?",
        tool_executor=fake_tool_executor
    ):
        chunks.append(chunk)

    # Verify tool was executed with exact args
    assert len(tool_called) == 1
    assert tool_called[0][0] == "search_book"
    assert tool_called[0][1] == {"query": "Capitu"}

    # Verify 2 HTTP calls occurred
    assert len(call_history) == 2
    # Verify Round 2 payload contains functionResponse and preserved thoughtSignature in model turn
    round2_contents = call_history[1]["contents"]
    assert len(round2_contents) == 3
    assert round2_contents[0]["role"] == "user"
    assert round2_contents[1]["role"] == "model"
    assert round2_contents[1]["parts"][0]["thoughtSignature"] == "thought_sig_123"
    assert round2_contents[2]["role"] == "user"
    assert round2_contents[2]["parts"][0]["functionResponse"]["name"] == "search_book"

    # Verify final streamed text
    assert "".join(chunks) == "Capitu já foi mencionada no Capítulo 2."



