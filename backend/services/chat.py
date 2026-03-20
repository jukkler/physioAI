import json
from typing import AsyncGenerator

import httpx
from config import OLLAMA_API_URL, LLM_MODEL
from prompts import CHAT_SYSTEM_PROMPT

TIMEOUT = 300.0

async def stream_chat(messages: list[dict]) -> AsyncGenerator[str, None]:
    full_messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}] + messages
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream(
            "POST",
            f"{OLLAMA_API_URL}/api/chat",
            json={
                "model": LLM_MODEL,
                "messages": full_messages,
                "stream": True,
                "think": False,
                "options": {
                    "temperature": 0.5,
                    "num_ctx": 4096,
                    "num_predict": 2048,
                },
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                data = json.loads(line)
                if data.get("done"):
                    break
                content = data.get("message", {}).get("content", "")
                if content:
                    yield content
