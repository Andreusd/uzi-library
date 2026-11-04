import json
import re
from typing import AsyncIterator, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse

from ..ai.manager import AIManager
from ..deps import get_ai_mgr, get_request_user
from ..users import UserManager
from ..database import get_db
from ..schemas import AIChatPayload, CreateAIConversationPayload, UpdateAIConversationPayload

router = APIRouter(tags=["ai"])

def generate_ai_title(prompt: str, location: Optional[str] = None) -> str:
    cleaned = re.sub(r'\s+', ' ', prompt or '').strip()
    if not cleaned:
        cleaned = "Nova conversa"

    loc_prefix = ""
    if location and len(location) <= 25 and not any(ext in location.lower() for ext in ('.xhtml', '.html', '.htm', '.xml')):
        loc_prefix = f"{location.strip()}: "

    max_len = 50 - len(loc_prefix)
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len].rsplit(' ', 1)[0] + "..."

    return f"{loc_prefix}{cleaned}"

@router.get("/api/ai/status")
async def get_ai_status(ai_mgr: AIManager = Depends(get_ai_mgr)):
    """Checks whether the local AI engine is available."""
    available = await ai_mgr.is_available()
    return {
        "available": available,
        "engine": "local_cli"
    }

@router.get("/api/ai/conversations")
async def list_conversations(
    book_id: str = Query(..., description="ID of the book to scope conversations"),
    user: str = Depends(get_request_user)
):
    """Returns all AI conversations for the given book and active user."""
    user_slug, _ = UserManager.normalize_username(user)
    db = get_db()
    conversations = db.list_ai_conversations(user_slug, book_id)
    return {"conversations": conversations}

@router.get("/api/ai/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    user: str = Depends(get_request_user)
):
    """Returns message history for a specific conversation."""
    user_slug, _ = UserManager.normalize_username(user)
    db = get_db()
    conv = db.get_ai_conversation(user_slug, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = db.get_ai_messages(conversation_id)
    return {
        "conversation": conv,
        "messages": messages
    }

@router.post("/api/ai/conversations")
async def create_conversation(
    payload: CreateAIConversationPayload,
    user: str = Depends(get_request_user)
):
    """Explicitly creates a new conversation thread."""
    user_slug, _ = UserManager.normalize_username(user)
    db = get_db()
    title = payload.title or generate_ai_title("Nova conversa", payload.location)
    conv = db.create_ai_conversation(
        user_slug=user_slug,
        book_id=payload.book_id,
        title=title
    )
    return {"conversation": conv}

@router.patch("/api/ai/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    payload: UpdateAIConversationPayload,
    user: str = Depends(get_request_user)
):
    """Renames or updates conversation metadata."""
    user_slug, _ = UserManager.normalize_username(user)
    db = get_db()
    clean_title = (payload.title or "").strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    conv = db.update_ai_conversation(user_slug, conversation_id, title=clean_title)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"conversation": conv}

@router.delete("/api/ai/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: str = Depends(get_request_user)
):
    """Deletes conversation, its messages, and any underlying CLI session cache."""
    user_slug, _ = UserManager.normalize_username(user)
    db = get_db()
    deleted = db.delete_ai_conversation(user_slug, conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted", "id": conversation_id}

@router.post("/api/ai/chat")
async def chat_stream(
    payload: AIChatPayload,
    user: str = Depends(get_request_user),
    ai_mgr: AIManager = Depends(get_ai_mgr)
):
    """
    Streams conversational responses via Server-Sent Events (SSE).
    Persists conversations and messages in SQLite scoped by user and book.
    """
    if not payload.messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty")

    user_slug, _ = UserManager.normalize_username(user)
    db = get_db()
    book_id = payload.book_id or "default"

    active_conv_id = payload.conversation_id
    active_conv = None
    agy_conv_id = None

    if active_conv_id:
        active_conv = db.get_ai_conversation(user_slug, active_conv_id)
        if active_conv:
            agy_conv_id = active_conv.get("agy_conversation_id")

    if not active_conv:
        last_user_prompt = payload.messages[-1].content
        title = generate_ai_title(last_user_prompt, payload.location)
        active_conv = db.create_ai_conversation(
            user_slug=user_slug,
            book_id=book_id,
            title=title,
            conversation_id=active_conv_id
        )
        active_conv_id = active_conv["id"]

    user_msg = payload.messages[-1]
    if user_msg.role == "user":
        db.add_ai_message(
            conversation_id=active_conv_id,
            role="user",
            content=user_msg.content,
            location=payload.location
        )

    async def event_generator() -> AsyncIterator[str]:
        try:
            # Emit initial event with verified conversation_id and title
            init_event = {
                "conversation_id": active_conv_id,
                "title": active_conv.get("title")
            }
            yield f"data: {json.dumps(init_event, ensure_ascii=False)}\n\n"

            msg_dicts = [m.model_dump() for m in payload.messages]
            ctx_dicts = [c.model_dump() for c in (payload.contexts or [])]
            accumulated_reply = []

            async for item in ai_mgr.stream_chat(
                messages=msg_dicts,
                conversation_id=agy_conv_id,
                book_id=payload.book_id,
                book_title=payload.book_title,
                book_author=payload.book_author,
                location=payload.location,
                page=payload.page,
                contexts=ctx_dicts,
                system_prompt=payload.system_prompt
            ):
                if isinstance(item, dict):
                    # Provider returned a structured event (e.g. CLIProvider yielded internal agy ID)
                    agy_id = item.get("conversation_id")
                    if agy_id:
                        db.update_ai_conversation(user_slug, active_conv_id, agy_conversation_id=agy_id)
                elif isinstance(item, str) and item:
                    accumulated_reply.append(item)
                    data = json.dumps({"chunk": item}, ensure_ascii=False)
                    yield f"data: {data}\n\n"

            # Save the complete assistant reply
            full_reply_text = "".join(accumulated_reply).strip()
            if full_reply_text:
                db.add_ai_message(
                    conversation_id=active_conv_id,
                    role="assistant",
                    content=full_reply_text,
                    location=payload.location
                )

            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            err_data = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {err_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/api/ai/message")
async def chat_message(
    payload: AIChatPayload,
    user: str = Depends(get_request_user),
    ai_mgr: AIManager = Depends(get_ai_mgr)
):
    """Non-streaming single-shot chat completion endpoint."""
    if not payload.messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty")

    user_slug, _ = UserManager.normalize_username(user)
    db = get_db()
    book_id = payload.book_id or "default"

    active_conv_id = payload.conversation_id
    active_conv = None
    agy_conv_id = None

    if active_conv_id:
        active_conv = db.get_ai_conversation(user_slug, active_conv_id)
        if active_conv:
            agy_conv_id = active_conv.get("agy_conversation_id")

    if not active_conv:
        last_user_prompt = payload.messages[-1].content
        title = generate_ai_title(last_user_prompt, payload.location)
        active_conv = db.create_ai_conversation(
            user_slug=user_slug,
            book_id=book_id,
            title=title,
            conversation_id=active_conv_id
        )
        active_conv_id = active_conv["id"]

    user_msg = payload.messages[-1]
    if user_msg.role == "user":
        db.add_ai_message(
            conversation_id=active_conv_id,
            role="user",
            content=user_msg.content,
            location=payload.location
        )

    msg_dicts = [m.model_dump() for m in payload.messages]
    ctx_dicts = [c.model_dump() for c in (payload.contexts or [])]

    reply = await ai_mgr.generate_chat(
        messages=msg_dicts,
        conversation_id=agy_conv_id,
        book_id=payload.book_id,
        book_title=payload.book_title,
        book_author=payload.book_author,
        location=payload.location,
        page=payload.page,
        contexts=ctx_dicts,
        system_prompt=payload.system_prompt
    )

    if reply and reply.strip():
        db.add_ai_message(
            conversation_id=active_conv_id,
            role="assistant",
            content=reply.strip(),
            location=payload.location
        )

    return {
        "reply": reply,
        "conversation_id": active_conv_id,
        "title": active_conv.get("title"),
        "status": "ok"
    }
