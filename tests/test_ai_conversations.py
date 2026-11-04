import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server.main import app
from server.deps import get_ai_mgr
from server.ai.manager import AIManager
from server.ai.providers import DummyProvider
from server.database import get_db

@pytest.fixture
def test_client():
    mgr = AIManager(provider=DummyProvider())
    app.dependency_overrides[get_ai_mgr] = lambda: mgr
    client = TestClient(app)
    yield client
    app.dependency_overrides.pop(get_ai_mgr, None)

def test_conversations_crud_and_user_scoping(test_client):
    headers_user_a = {"X-User": "alice"}
    headers_user_b = {"X-User": "bob"}
    book_id = "test-book-123"

    # 1. Create conversation for Alice
    res = test_client.post(
        "/api/ai/conversations",
        json={"book_id": book_id, "title": "Dúvida sobre o Capítulo 1", "location": "Cap. 1"},
        headers=headers_user_a
    )
    assert res.status_code == 200
    conv_a = res.json()["conversation"]
    assert conv_a["title"] == "Dúvida sobre o Capítulo 1"
    assert conv_a["book_id"] == book_id
    conv_a_id = conv_a["id"]

    # 2. Bob should NOT see Alice's conversation
    res_bob = test_client.get(f"/api/ai/conversations?book_id={book_id}", headers=headers_user_b)
    assert res_bob.status_code == 200
    assert len(res_bob.json()["conversations"]) == 0

    # 3. Alice should see her conversation
    res_alice = test_client.get(f"/api/ai/conversations?book_id={book_id}", headers=headers_user_a)
    assert res_alice.status_code == 200
    convs = res_alice.json()["conversations"]
    assert len(convs) == 1
    assert convs[0]["id"] == conv_a_id

    # 4. Update (rename) conversation
    res_rename = test_client.patch(
        f"/api/ai/conversations/{conv_a_id}",
        json={"title": "Título Atualizado do Cap. 1"},
        headers=headers_user_a
    )
    assert res_rename.status_code == 200
    assert res_rename.json()["conversation"]["title"] == "Título Atualizado do Cap. 1"

    # Bob cannot rename Alice's conversation
    res_bob_rename = test_client.patch(
        f"/api/ai/conversations/{conv_a_id}",
        json={"title": "Hacked Title"},
        headers=headers_user_b
    )
    assert res_bob_rename.status_code == 404

    # 5. Delete conversation
    res_delete = test_client.delete(f"/api/ai/conversations/{conv_a_id}", headers=headers_user_a)
    assert res_delete.status_code == 200
    assert res_delete.json()["status"] == "deleted"

    # Verify Alice has 0 conversations now
    res_alice_after = test_client.get(f"/api/ai/conversations?book_id={book_id}", headers=headers_user_a)
    assert len(res_alice_after.json()["conversations"]) == 0

def test_chat_auto_creates_conversation_and_stores_messages(test_client):
    import uuid
    headers = {"X-User": "carlos"}
    book_id = f"book-auto-create-{uuid.uuid4().hex[:8]}"

    # Send first message without conversation_id
    payload = {
        "messages": [{"role": "user", "content": "O que significa a caverna de Platão?"}],
        "book_id": book_id,
        "book_title": "A República",
        "location": "Livro VII"
    }

    res = test_client.post("/api/ai/chat", json=payload, headers=headers)
    assert res.status_code == 200

    # Verify conversation was persisted in DB
    convs_res = test_client.get(f"/api/ai/conversations?book_id={book_id}", headers=headers)
    assert convs_res.status_code == 200
    convs = convs_res.json()["conversations"]
    assert len(convs) == 1
    created_conv = convs[0]
    assert "Livro VII" in created_conv["title"] or "caverna" in created_conv["title"]
    assert created_conv["message_count"] == 2  # user + assistant

    # Fetch messages
    msg_res = test_client.get(f"/api/ai/conversations/{created_conv['id']}/messages", headers=headers)
    assert msg_res.status_code == 200
    msgs = msg_res.json()["messages"]
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert "caverna" in msgs[0]["content"]
    assert msgs[1]["role"] == "assistant"
