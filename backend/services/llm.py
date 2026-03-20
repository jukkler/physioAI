import urllib.request

import httpx
from config import OLLAMA_API_URL, LLM_MODEL
from prompts import CORRECTION_PROMPT, SUMMARIZATION_PROMPT

TIMEOUT = 300.0


def _claim_gpu():
    try:
        req = urllib.request.Request("http://gpu-manager:8090/gpu/claim/ollama", method="POST")
        urllib.request.urlopen(req, timeout=60)
    except Exception:
        pass


async def _generate(prompt: str, temperature: float, num_predict: int) -> str:
    _claim_gpu()
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(
            f"{OLLAMA_API_URL}/api/generate",
            json={
                "model": LLM_MODEL,
                "prompt": prompt,
                "stream": False,
                "think": False,
                "options": {
                    "temperature": temperature,
                    "num_ctx": 8192,
                    "num_predict": num_predict,
                },
            },
        )
        response.raise_for_status()
        return response.json()["response"]


async def correct_transcript(raw_text: str) -> str:
    prompt = CORRECTION_PROMPT.format(transcript=raw_text)
    return await _generate(prompt, temperature=0.1, num_predict=4096)


async def summarize_transcript(corrected_text: str) -> str:
    prompt = SUMMARIZATION_PROMPT.format(transcript=corrected_text)
    return await _generate(prompt, temperature=0.3, num_predict=2048)
