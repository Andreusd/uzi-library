import os
import json
import shutil
import asyncio
from abc import ABC, abstractmethod
from typing import AsyncIterator, List, Dict, Any, Optional

class BaseAIProvider(ABC):
    """Abstract interface for AI generation engines, keeping the backend provider-agnostic."""

    @abstractmethod
    async def is_available(self) -> bool:
        """Returns True if the underlying AI service or CLI is available."""
        pass

    @abstractmethod
    async def stream_chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> AsyncIterator[Any]:
        """Streams text chunks or metadata events in response to the given prompt and instructions."""
        pass

    @abstractmethod
    async def generate_chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> str:
        """Generates a complete response for the given prompt."""
        pass


class CLIProvider(BaseAIProvider):
    """
    Decoupled command-line AI engine.
    Executes a local AI CLI command non-interactively without vendor branding in logs or responses.
    Supports session continuity via conversation IDs (e.g. agy --conversation <id>).
    """

    def __init__(self, cli_command: Optional[str] = None):
        self.cli_command = cli_command or os.environ.get("UZI_AI_CLI_COMMAND", "agy")

    async def is_available(self) -> bool:
        cmd_bin = self.cli_command.split()[0] if self.cli_command else ""
        return bool(cmd_bin and shutil.which(cmd_bin))

    def _build_full_prompt(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        if system_prompt and system_prompt.strip():
            return f"[Instruções do Sistema]\n{system_prompt.strip()}\n\n[Solicitação do Usuário]\n{prompt.strip()}"
        return prompt.strip()

    async def stream_chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> AsyncIterator[Any]:
        if not await self.is_available():
            yield "O motor de inteligência local não foi encontrado ou não está configurado no sistema."
            return

        full_prompt = self._build_full_prompt(prompt, system_prompt)
        cmd_parts = self.cli_command.split()
        is_agy = bool(cmd_parts and os.path.basename(cmd_parts[0]) == "agy")

        # Security hardening: NEVER allow automatic tool permissions for chat users.
        # Enforce sandbox and disable slash command / skill expansions.
        clean_parts = [p for p in cmd_parts if p != "--dangerously-skip-permissions"]
        if is_agy:
            if "--sandbox" not in clean_parts:
                clean_parts.append("--sandbox")
            if "--disable-slash-commands" not in clean_parts:
                clean_parts.append("--disable-slash-commands")
            if "--output-format" not in clean_parts:
                clean_parts.extend(["--output-format", "stream-json"])
            
            # Resume existing conversation if conversation_id is provided
            if conversation_id:
                clean_parts.extend(["--conversation", conversation_id])
                args = [*clean_parts, "-p", prompt.strip()]
            else:
                args = [*clean_parts, "-p", full_prompt]
        else:
            args = [*clean_parts, "-p", full_prompt]

        try:
            # Run in isolated directory (/tmp) to prevent accidental filesystem access
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd="/tmp"
            )

            chunks_count = 0
            if is_agy and "--output-format" in args:
                # Read stream-json line by line
                while True:
                    line = await proc.stdout.readline()
                    if not line:
                        break
                    raw = line.decode("utf-8", errors="replace").strip()
                    if not raw:
                        continue
                    try:
                        data = json.loads(raw)
                        if isinstance(data, dict):
                            event = data.get("event")
                            if event == "init":
                                cid = data.get("conversation_id")
                                if cid:
                                    yield {"conversation_id": cid}
                            elif event == "step_update":
                                delta = data.get("step_update", {}).get("text_delta")
                                if delta:
                                    chunks_count += 1
                                    yield delta
                            elif event == "result":
                                cid = data.get("result", {}).get("conversation_id")
                                if cid:
                                    yield {"conversation_id": cid}
                            continue
                    except Exception:
                        pass
                    # Fallback if non-JSON line appears
                    chunks_count += 1
                    yield raw + "\n"
            else:
                # Fallback for plain-text streaming
                while True:
                    chunk = await proc.stdout.read(256)
                    if not chunk:
                        break
                    chunks_count += 1
                    yield chunk.decode("utf-8", errors="replace")

            await proc.wait()
            stderr_output = (await proc.stderr.read()).decode("utf-8", errors="replace").strip()
            if chunks_count == 0 and stderr_output:
                if "auto-denied" in stderr_output or "permission" in stderr_output.lower():
                    yield "Ação bloqueada por segurança: o assistente do Uzi Library opera exclusivamente como leitor de texto e não executa comandos nem acessa arquivos do sistema."
                else:
                    yield f"[Aviso do assistente: {stderr_output}]"
            elif proc.returncode != 0 and stderr_output:
                if "auto-denied" in stderr_output or "permission" in stderr_output.lower():
                    yield "\n\n[Ação bloqueada: execução de ferramentas e comandos não é permitida no assistente de leitura.]"
                else:
                    yield f"\n\n[Aviso: O motor encerrou com aviso ({proc.returncode}): {stderr_output}]"
        except Exception as e:
            yield f"\n\n[Erro na comunicação com o assistente local: {str(e)}]"

    async def generate_chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> str:
        chunks = []
        async for chunk in self.stream_chat(prompt, system_prompt, conversation_id):
            if isinstance(chunk, str):
                chunks.append(chunk)
        return "".join(chunks)


class DummyProvider(BaseAIProvider):
    """Fallback / Mock AI provider for testing or environments without a local LLM CLI."""

    async def is_available(self) -> bool:
        return True

    async def stream_chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> AsyncIterator[Any]:
        yield {"conversation_id": conversation_id or "dummy-conv-123"}
        yield "Olá! Sou o assistente de leitura com IA do Uzi Library. "
        await asyncio.sleep(0.05)
        yield "Recebi seu trecho e estou pronto para auxiliar na leitura."

    async def generate_chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> str:
        return "Olá! Sou o assistente de leitura com IA do Uzi Library. Recebi seu trecho e estou pronto para auxiliar na leitura."
