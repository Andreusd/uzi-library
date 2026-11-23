import os
from typing import AsyncIterator, List, Dict, Any, Optional
from .providers import BaseAIProvider, GeminiProvider, DummyProvider
from .context import BookContextExtractor

DEFAULT_SYSTEM_PROMPT = (
    "You are the intelligent reading assistant integrated into Uzi Library, specialized in literary analysis, reading support, and concept explanation.\n\n"
    "CORE DIRECTIVES:\n"
    "1. ANTI-SPOILER RULE: Never reveal future events, plot twists, or endings that occur after the reader's current location in the book, unless the reader explicitly asks for spoilers.\n"
    "2. FOCUS ON WHAT MATTERS: When the reader highlights specific passages, focus on them as the primary subject. The book's broader context serves as background reference.\n"
    "3. SIDEBAR / SKIMMABLE FORMAT: Your answers are read in a narrow sidebar. Format with:\n"
    "   - Short, punchy paragraphs (2 to 4 lines maximum).\n"
    "   - Bullet points for lists, comparisons, or multi-step explanations.\n"
    "   - Bold key terms so the reader can easily skim.\n"
    "   - No empty preamble or repetitive conversational fluff (such as 'Sure!', 'Great question!'). Get straight to the point.\n"
    "4. BOOK SEARCH TOOL: You have access to the `search_book` tool. When the reader asks if a character, term, concept, or event has appeared or been mentioned before (e.g., 'is this their first appearance?', 'where was this introduced?'), ALWAYS call `search_book` to search prior chapters/pages up to the current location, and cite previous occurrences and chapter names accurately.\n"
    "5. TONE: Educational, clear, elegant, and engaging, seamlessly adapting to the genre of the book (fiction, non-fiction, essay, technical, poetry).\n"
    "6. LANGUAGE MATCHING: Always reply in the exact same language used by the reader in their message (e.g., if the user asks in Portuguese, answer in Portuguese; if in English, answer in English; if in Spanish, answer in Spanish; if in French, answer in French)."
)

def get_default_provider() -> BaseAIProvider:
    provider_pref = os.environ.get("UZI_AI_PROVIDER", "").lower().strip()
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip() or None

    if provider_pref == "dummy":
        return DummyProvider()

    # Default provider: Google Gemini Flash
    return GeminiProvider(api_key=gemini_key)

class AIManager:
    """Orchestrates AI interactions, reading context injection, and conversation formatting."""

    def __init__(
        self,
        provider: Optional[BaseAIProvider] = None,
        extractor: Optional[BookContextExtractor] = None
    ):
        self.provider = provider or get_default_provider()
        self.extractor = extractor or BookContextExtractor()

    async def is_available(self) -> bool:
        return await self.provider.is_available()

    def build_prompt_context(
        self,
        messages: List[Dict[str, str]],
        conversation_id: Optional[str] = None,
        book_id: Optional[str] = None,
        book_title: Optional[str] = None,
        book_author: Optional[str] = None,
        location: Optional[str] = None,
        page: Optional[int] = None,
        contexts: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """
        Formats prompt for the AI model.
        When continuing an existing conversation session (conversation_id provided),
        sends only the incremental query, active selections, and current location.
        When starting a new conversation (conversation_id is None), initializes with book metadata,
        TOC, active selections, and chapter text.
        """
        # Session continuation (Turn 2+): send only incremental delta
        if conversation_id:
            incremental_parts = []
            if contexts and len(contexts) > 0:
                ctx_lines = ["--- Reader Highlighted Excerpts ---"]
                for idx, ctx in enumerate(contexts, 1):
                    loc_info = f" ({ctx.get('location')})" if ctx.get('location') else ""
                    snippet = ctx.get('text', '').strip()
                    if snippet:
                        ctx_lines.append(f"[Ref {idx}{loc_info}]: \"{snippet}\"")
                if len(ctx_lines) > 1:
                    incremental_parts.append("\n".join(ctx_lines))

            if location:
                incremental_parts.append(f"[Current location: {location}]")

            last_msg = messages[-1].get("content", "").strip() if messages else ""
            if last_msg:
                incremental_parts.append(last_msg)

            return "\n\n".join(incremental_parts) if incremental_parts else last_msg

        # Initial turn (Turn 1): Full book context
        parts = []

        surrounding = {}
        if self.extractor and book_id:
            try:
                extracted = self.extractor.extract_context_for_book(book_id, location=location, page=page)
                surrounding = extracted.get("surrounding", {}) or {}
                db_book = extracted.get("book")
                if db_book:
                    book_title = book_title or db_book.get("title")
                    book_author = book_author or db_book.get("author")
            except Exception:
                pass

        # Book metadata & table of contents
        if book_title or book_author or location:
            meta_lines = ["--- Active Book Reading Context ---"]
            if book_title:
                meta_lines.append(f"Title: {book_title}")
            if book_author:
                meta_lines.append(f"Author: {book_author}")
            if location:
                meta_lines.append(f"Current Location / Page: {location}")

            toc_list = surrounding.get("toc", [])
            if toc_list:
                meta_lines.append("Table of Contents:")
                for item in toc_list[:20]:
                    meta_lines.append(f"  • {item}")

            parts.append("\n".join(meta_lines))

        # Attached context snippets (highlights / selections) - high priority
        has_selections = bool(contexts and len(contexts) > 0)
        if has_selections:
            ctx_lines = ["--- Reader Highlighted Excerpts (Primary Focus) ---"]
            for idx, ctx in enumerate(contexts, 1):
                loc_info = f" ({ctx.get('location')})" if ctx.get('location') else ""
                snippet = ctx.get('text', '').strip()
                if snippet:
                    ctx_lines.append(f"[Ref {idx}{loc_info}]: \"{snippet}\"")
            if len(ctx_lines) > 1:
                parts.append("\n".join(ctx_lines))

        def _clean_title(t: Optional[str]) -> str:
            if not t:
                return ""
            if any(t.lower().endswith(ext) for ext in ('.xhtml', '.html', '.htm', '.xml')):
                return ""
            return f" ({t})"

        # When the reader selected specific text, we inject only the immediate current chapter
        # as background reference to keep maximum focus on the highlighted passage.
        # If no specific snippet was selected, we provide the current chapter and previous chapter for continuity.
        # NOTE: 'next_chapter' is NEVER included to strictly enforce the Anti-Spoiler rule.
        curr_ch = surrounding.get("current_chapter", {})
        if curr_ch.get("text"):
            title = _clean_title(curr_ch.get("title"))
            parts.append(f"--- Current Reading Chapter / Section{title} ---\n{curr_ch['text']}")

        if not has_selections:
            prev_ch = surrounding.get("prev_chapter", {})
            if prev_ch.get("text"):
                title = _clean_title(prev_ch.get("title"))
                parts.append(f"--- Previous Chapter / Section{title} ---\n{prev_ch['text']}")

        # Conversation history
        if messages:
            hist_lines = ["--- Conversation History ---"]
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "").strip()
                if not content:
                    continue
                role_label = "Reader" if role == "user" else "Assistant"
                hist_lines.append(f"{role_label}: {content}")
            parts.append("\n".join(hist_lines))

        return "\n\n".join(parts)

    def build_multiturn_messages(
        self,
        messages: List[Dict[str, str]],
        conversation_id: Optional[str] = None,
        book_id: Optional[str] = None,
        book_title: Optional[str] = None,
        book_author: Optional[str] = None,
        location: Optional[str] = None,
        page: Optional[int] = None,
        contexts: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, str]]:
        """
        Prepares a structured multi-turn conversation list for conversational providers (e.g. Gemini).
        - For turn 1 (or single message), injects full book context into the user's initial prompt.
        - For subsequent turns, preserves conversational history and injects newly highlighted snippets
          and the current reader location into the latest user message.
        """
        if not messages:
            return []

        if len(messages) <= 1:
            content = self.build_prompt_context(
                messages=messages,
                conversation_id=conversation_id,
                book_id=book_id,
                book_title=book_title,
                book_author=book_author,
                location=location,
                page=page,
                contexts=contexts
            )
            return [{"role": "user", "content": content}]

        result = []
        for idx, m in enumerate(messages):
            role = m.get("role", "user")
            content = m.get("content", "").strip()

            if idx == 0 and role == "user":
                initial_context = self.build_prompt_context(
                    messages=[{"role": "user", "content": content}],
                    conversation_id=None,
                    book_id=book_id,
                    book_title=book_title,
                    book_author=book_author,
                    location=location,
                    page=page,
                    contexts=None
                )
                result.append({"role": "user", "content": initial_context})
            elif idx == len(messages) - 1 and role == "user":
                delta_parts = []
                if contexts and len(contexts) > 0:
                    ctx_lines = ["--- Reader Highlighted Excerpt ---"]
                    for c_idx, ctx in enumerate(contexts, 1):
                        loc_info = f" ({ctx.get('location')})" if ctx.get('location') else ""
                        snippet = ctx.get('text', '').strip()
                        if snippet:
                            ctx_lines.append(f"[Ref {c_idx}{loc_info}]: \"{snippet}\"")
                    if len(ctx_lines) > 1:
                        delta_parts.append("\n".join(ctx_lines))
                if location:
                    delta_parts.append(f"[Current location: {location}]")
                if content:
                    delta_parts.append(content)
                result.append({"role": "user", "content": "\n\n".join(delta_parts) if delta_parts else content})
            else:
                result.append({"role": role, "content": content})

        return result

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        conversation_id: Optional[str] = None,
        book_id: Optional[str] = None,
        book_title: Optional[str] = None,
        book_author: Optional[str] = None,
        location: Optional[str] = None,
        page: Optional[int] = None,
        contexts: Optional[List[Dict[str, Any]]] = None,
        system_prompt: Optional[str] = None
    ) -> AsyncIterator[Any]:
        multiturn = self.build_multiturn_messages(
            messages=messages,
            conversation_id=conversation_id,
            book_id=book_id,
            book_title=book_title,
            book_author=book_author,
            location=location,
            page=page,
            contexts=contexts
        )
        sys_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
        prompt_text = multiturn[-1]["content"] if multiturn else ""

        tool_executor = None
        if book_id and self.extractor:
            async def _executor(name: str, args: Dict[str, Any]) -> Dict[str, Any]:
                if name == "search_book":
                    query = args.get("query", "").strip()
                    if not query:
                        return {"results": [], "count": 0, "message": "Search query was empty."}
                    matches = self.extractor.search_book_text(
                        book_id=book_id,
                        query=query,
                        location_hint=location,
                        page_hint=page
                    )
                    return {"results": matches, "count": len(matches)}
                return {"error": f"Unknown tool: {name}"}
            tool_executor = _executor

        async for chunk in self.provider.stream_chat(
            prompt=prompt_text,
            system_prompt=sys_prompt,
            conversation_id=conversation_id,
            messages=multiturn,
            tool_executor=tool_executor
        ):
            yield chunk

    async def generate_chat(
        self,
        messages: List[Dict[str, str]],
        conversation_id: Optional[str] = None,
        book_id: Optional[str] = None,
        book_title: Optional[str] = None,
        book_author: Optional[str] = None,
        location: Optional[str] = None,
        page: Optional[int] = None,
        contexts: Optional[List[Dict[str, Any]]] = None,
        system_prompt: Optional[str] = None
    ) -> str:
        multiturn = self.build_multiturn_messages(
            messages=messages,
            conversation_id=conversation_id,
            book_id=book_id,
            book_title=book_title,
            book_author=book_author,
            location=location,
            page=page,
            contexts=contexts
        )
        sys_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
        prompt_text = multiturn[-1]["content"] if multiturn else ""

        tool_executor = None
        if book_id and self.extractor:
            async def _executor(name: str, args: Dict[str, Any]) -> Dict[str, Any]:
                if name == "search_book":
                    query = args.get("query", "").strip()
                    if not query:
                        return {"results": [], "count": 0, "message": "Search query was empty."}
                    matches = self.extractor.search_book_text(
                        book_id=book_id,
                        query=query,
                        location_hint=location,
                        page_hint=page
                    )
                    return {"results": matches, "count": len(matches)}
                return {"error": f"Unknown tool: {name}"}
            tool_executor = _executor

        return await self.provider.generate_chat(
            prompt=prompt_text,
            system_prompt=sys_prompt,
            conversation_id=conversation_id,
            messages=multiturn,
            tool_executor=tool_executor
        )
