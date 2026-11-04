import os
from typing import AsyncIterator, List, Dict, Any, Optional
from .providers import BaseAIProvider, CLIProvider, DummyProvider
from .context import BookContextExtractor

DEFAULT_SYSTEM_PROMPT = (
    "Você é o assistente inteligente de leitura integrado ao Uzi Library.\n"
    "Seu papel é auxiliar o leitor tirando dúvidas, explicando passagens, analisando conceitos e contextualizando ideias da obra de forma didática e instigante.\n\n"
    "DIRETRIZES DE ATUAÇÃO:\n"
    "1. Prioridade e Foco: Quando o leitor destacar trechos específicos, foque neles como assunto principal. O texto do capítulo e o sumário servem como apoio e contexto.\n"
    "2. Tom e Concisão: Seja direto, claro e elegante. Evite respostas prolixas ou excessivamente longas, a não ser que o leitor peça um aprofundamento ou explicação detalhada.\n"
    "3. Conhecimento Externo & Web: Você pode consultar a internet ou conhecimentos externos sobre fatos históricos, biografia do autor, termos técnicos ou contexto geral para enriquecer a resposta.\n"
    "4. Idioma: Responda sempre no mesmo idioma utilizado pelo leitor."
)

class AIManager:
    """Orchestrates AI interactions, reading context injection, and conversation formatting."""

    def __init__(
        self,
        provider: Optional[BaseAIProvider] = None,
        extractor: Optional[BookContextExtractor] = None
    ):
        self.provider = provider or CLIProvider()
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
                ctx_lines = ["--- Trechos Selecionados pelo Leitor ---"]
                for idx, ctx in enumerate(contexts, 1):
                    loc_info = f" ({ctx.get('location')})" if ctx.get('location') else ""
                    snippet = ctx.get('text', '').strip()
                    if snippet:
                        ctx_lines.append(f"[Ref {idx}{loc_info}]: \"{snippet}\"")
                if len(ctx_lines) > 1:
                    incremental_parts.append("\n".join(ctx_lines))

            if location:
                incremental_parts.append(f"[Localização atual: {location}]")

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
            meta_lines = ["--- Contexto do Livro em Leitura ---"]
            if book_title:
                meta_lines.append(f"Título: {book_title}")
            if book_author:
                meta_lines.append(f"Autor: {book_author}")
            if location:
                meta_lines.append(f"Localização/Página atual: {location}")

            toc_list = surrounding.get("toc", [])
            if toc_list:
                meta_lines.append("Sumário da Obra:")
                for item in toc_list[:20]:
                    meta_lines.append(f"  • {item}")

            parts.append("\n".join(meta_lines))

        # Attached context snippets (highlights / selections) - high priority
        if contexts and len(contexts) > 0:
            ctx_lines = ["--- Trechos Selecionados / Referências Ativas do Leitor ---"]
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

        curr_ch = surrounding.get("current_chapter", {})
        if curr_ch.get("text"):
            title = _clean_title(curr_ch.get("title"))
            parts.append(f"--- Capítulo/Trecho Atual em Leitura{title} ---\n{curr_ch['text']}")

        prev_ch = surrounding.get("prev_chapter", {})
        if prev_ch.get("text"):
            title = _clean_title(prev_ch.get("title"))
            parts.append(f"--- Capítulo/Trecho Anterior{title} ---\n{prev_ch['text']}")

        next_ch = surrounding.get("next_chapter", {})
        if next_ch.get("text"):
            title = _clean_title(next_ch.get("title"))
            parts.append(f"--- Próximo Capítulo/Trecho{title} ---\n{next_ch['text']}")

        # Conversation history
        if messages:
            hist_lines = ["--- Conversa com o Leitor ---"]
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "").strip()
                if not content:
                    continue
                role_label = "Leitor" if role == "user" else "Assistente"
                hist_lines.append(f"{role_label}: {content}")
            parts.append("\n".join(hist_lines))

        return "\n\n".join(parts)

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
        full_prompt = self.build_prompt_context(
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
        async for chunk in self.provider.stream_chat(
            prompt=full_prompt,
            system_prompt=sys_prompt if not conversation_id else None,
            conversation_id=conversation_id
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
        full_prompt = self.build_prompt_context(
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
        return await self.provider.generate_chat(
            prompt=full_prompt,
            system_prompt=sys_prompt if not conversation_id else None,
            conversation_id=conversation_id
        )
