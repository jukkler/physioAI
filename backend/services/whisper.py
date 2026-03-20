import httpx
from config import WHISPER_API_URL

TIMEOUT = 600.0


async def transcribe_chunk(audio_bytes: bytes) -> str:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(
            f"{WHISPER_API_URL}/v1/audio/transcriptions",
            files={"file": ("chunk.webm", audio_bytes, "audio/webm")},
            data={
                "language": "de",
                "response_format": "json",
            },
        )
        response.raise_for_status()
        return response.json()["text"]


async def transcribe_full(audio_path: str) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        with open(audio_path, "rb") as f:
            response = await client.post(
                f"{WHISPER_API_URL}/v1/audio/transcriptions",
                files={"file": (audio_path.split("/")[-1], f, "audio/webm")},
                data={
                    "language": "de",
                    "response_format": "verbose_json",
                    "timestamp_granularities[]": "segment",
                },
            )
        response.raise_for_status()
        data = response.json()
        return {
            "text": data["text"],
            "segments": data.get("segments", []),
            "duration": data.get("duration", 0.0),
        }
