import os
import json
import asyncio
from abc import ABC, abstractmethod
from typing import AsyncIterator, List, Dict, Any, Optional, Callable, Awaitable

from ..database import get_db, Database

SEARCH_BOOK_TOOL: Dict[str, Any] = {
    "functionDeclarations": [
        {
            "name": "search_book",
            "description": (
                "Searches earlier chapters or pages of the active book up to the reader's current location "
                "for previous mentions of a character, term, event, or phrase. "
                "Returns matching chapter names, pages, and context snippets."
            ),
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "query": {
                        "type": "STRING",
                        "description": "The exact character name, term, keyword, or phrase to search for."
                    }
                },
                "required": ["query"]
            }
        }
    ]
}

class BaseAIProvider(ABC):
    """Abstract interface for AI generation engines, keeping the backend provider-agnostic."""
    engine_name: str = "base"

    @abstractmethod
    async def is_available(self) -> bool:
        """Returns True if the underlying AI service is available."""
        pass

    @abstractmethod
    async def stream_chat(
        self,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None,
        messages: Optional[List[Dict[str, str]]] = None,
        tool_executor: Optional[Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]]] = None
    ) -> AsyncIterator[Any]:
        """Streams text chunks or metadata events in response to the given prompt and instructions."""
        pass

    @abstractmethod
    async def generate_chat(
        self,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None,
        messages: Optional[List[Dict[str, str]]] = None,
        tool_executor: Optional[Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]]] = None
    ) -> str:
        """Generates a complete response for the given prompt."""
        pass


class GeminiProvider(BaseAIProvider):
    """
    Direct Google Gemini API provider.
    Streams via Google's official REST SSE endpoint without spawning CLI processes
    or accessing any local files. Reads API key and model from SQLite settings.
    """
    engine_name = "gemini_flash"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        db: Optional[Database] = None
    ):
        self._db = db
        self._api_key = api_key
        self._model = model

    @property
    def db(self) -> Database:
        if self._db is None:
            self._db = get_db()
        return self._db

    @property
    def api_key(self) -> str:
        if self._api_key is not None:
            return self._api_key.strip()
        try:
            stored = self.db.get_setting("gemini_api_key")
            if stored and isinstance(stored, str) and stored.strip():
                return stored.strip()
        except Exception:
            pass
        return os.environ.get("GEMINI_API_KEY", "").strip()

    @api_key.setter
    def api_key(self, val: Optional[str]):
        self._api_key = val.strip() if val is not None else None

    @property
    def model(self) -> str:
        if self._model is not None:
            return self._model.strip()
        try:
            stored = self.db.get_setting("gemini_model")
            if stored and isinstance(stored, str) and stored.strip():
                return stored.strip()
        except Exception:
            pass
        return os.environ.get("GEMINI_MODEL", "gemini-3.5-flash").strip()

    @model.setter
    def model(self, val: Optional[str]):
        self._model = val.strip() if val is not None else None

    async def is_available(self) -> bool:
        return bool(self.api_key)

    @staticmethod
    def _format_gemini_contents(messages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        contents = []
        for m in messages:
            raw_role = m.get("role", "user")
            role = "model" if raw_role in ("model", "assistant") else "user"
            content = m.get("content", "").strip()
            if not content:
                continue
            if contents and contents[-1]["role"] == role:
                contents[-1]["parts"][0]["text"] += "\n\n" + content
            else:
                contents.append({"role": role, "parts": [{"text": content}]})
        while contents and contents[0]["role"] != "user":
            contents.pop(0)
        return contents

    async def stream_chat(
        self,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None,
        messages: Optional[List[Dict[str, str]]] = None,
        tool_executor: Optional[Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]]] = None
    ) -> AsyncIterator[Any]:
        if not await self.is_available():
            yield "A chave da API Gemini não foi configurada. Abra as Configurações (ícone de engrenagem) ou o painel de IA para inserir sua chave gratuita do Google AI Studio."
            return

        import httpx

        contents = []
        if messages:
            contents = self._format_gemini_contents(messages)
        elif prompt and prompt.strip():
            contents = [{"role": "user", "parts": [{"text": prompt.strip()}]}]

        if not contents:
            yield "[Nenhuma mensagem para processar]"
            return

        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7
            }
        }

        if tool_executor is not None:
            payload["tools"] = [SEARCH_BOOK_TOOL]

        if system_prompt and system_prompt.strip():
            payload["systemInstruction"] = {
                "parts": [{"text": system_prompt.strip()}]
            }

        models_to_try = [self.model]
        fallback_model = "gemini-3.8-flash" if self.model == "gemini-3.5-flash" else "gemini-3.5-flash"
        if fallback_model not in models_to_try:
            models_to_try.append(fallback_model)

        last_error = ""
        for current_model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:streamGenerateContent?alt=sse&key={self.api_key}"
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    round_num = 0
                    max_rounds = 2
                    while round_num <= max_rounds:
                        round_num += 1
                        function_call = None
                        model_parts = []

                        async with client.stream("POST", url, json=payload) as response:
                            if response.status_code != 200:
                                err_body = await response.aread()
                                try:
                                    err_json = json.loads(err_body)
                                    err_msg = err_json.get("error", {}).get("message", err_body.decode(errors="replace"))
                                except Exception:
                                    err_msg = err_body.decode(errors="replace")
                                last_error = f"[Erro na API Gemini ({response.status_code}): {err_msg}]"
                                # If 503 (high demand) or 404 (unavailable), try next fallback model
                                if response.status_code in (503, 404) and current_model != models_to_try[-1]:
                                    break
                                yield last_error
                                return

                            async for line in response.aiter_lines():
                                line = line.strip()
                                if not line or not line.startswith("data: "):
                                    continue
                                data_str = line[6:].strip()
                                if not data_str:
                                    continue
                                try:
                                    data = json.loads(data_str)
                                    for cand in data.get("candidates", []):
                                        parts = cand.get("content", {}).get("parts", [])
                                        for part in parts:
                                            if "functionCall" in part:
                                                function_call = part["functionCall"]
                                                model_parts = parts
                                            elif "text" in part:
                                                yield part["text"]
                                except Exception:
                                    continue

                        if function_call and tool_executor:
                            call_name = function_call.get("name")
                            call_args = function_call.get("args") or {}
                            call_id = function_call.get("id")

                            try:
                                tool_result = await tool_executor(call_name, call_args)
                            except Exception as e:
                                tool_result = {"error": f"Tool execution failed: {str(e)}"}

                            # Append model turn preserving exact parts (including thoughtSignature)
                            contents.append({
                                "role": "model",
                                "parts": model_parts
                            })

                            # Append user turn containing functionResponse
                            func_resp = {
                                "name": call_name,
                                "response": tool_result
                            }
                            if call_id:
                                func_resp["id"] = call_id

                            contents.append({
                                "role": "user",
                                "parts": [{"functionResponse": func_resp}]
                            })

                            payload["contents"] = contents
                            continue
                        else:
                            return
            except Exception as e:
                last_error = f"[Erro na comunicação com a API Gemini: {str(e)}]"
                if current_model != models_to_try[-1]:
                    continue
                yield last_error
                return

    async def generate_chat(
        self,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None,
        messages: Optional[List[Dict[str, str]]] = None,
        tool_executor: Optional[Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]]] = None
    ) -> str:
        chunks = []
        async for chunk in self.stream_chat(prompt, system_prompt, conversation_id, messages=messages, tool_executor=tool_executor):
            if isinstance(chunk, str):
                chunks.append(chunk)
        return "".join(chunks)


class DummyProvider(BaseAIProvider):
    """Fallback / Mock AI provider for testing or environments without a configured API key."""
    engine_name = "dummy"

    async def is_available(self) -> bool:
        return True

    async def stream_chat(
        self,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None,
        messages: Optional[List[Dict[str, str]]] = None,
        tool_executor: Optional[Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]]] = None
    ) -> AsyncIterator[Any]:
        yield {"conversation_id": conversation_id or "dummy-conv-123"}
        yield "Olá! Sou o assistente de leitura com IA do Uzi Library. "
        await asyncio.sleep(0.05)
        yield "Recebi seu trecho e estou pronto para auxiliar na leitura."

    async def generate_chat(
        self,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None,
        messages: Optional[List[Dict[str, str]]] = None,
        tool_executor: Optional[Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]]] = None
    ) -> str:
        return "Olá! Sou o assistente de leitura com IA do Uzi Library. Recebi seu trecho e estou pronto para auxiliar na leitura."
