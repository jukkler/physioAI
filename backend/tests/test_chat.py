import pytest
from services.factory import get_chat_service
from httpx import AsyncClient, ASGITransport
from app import app
import json as json_module


@pytest.fixture(autouse=True)
def use_mocks(monkeypatch):
    monkeypatch.setenv("USE_MOCKS", "true")


@pytest.mark.asyncio
async def test_chat_stream_yields_tokens():
    chat = get_chat_service()
    messages = [{"role": "user", "content": "Was ist ein Lasègue-Test?"}]
    tokens = []
    async for token in chat.stream_chat(messages):
        tokens.append(token)
    assert len(tokens) > 0
    full_text = "".join(tokens)
    assert len(full_text) > 10


@pytest.mark.asyncio
async def test_chat_api_streams_sse():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/chat",
            json={"message": "Was ist ein Lasègue-Test?", "history": []},
        )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    lines = [l for l in response.text.strip().split("\n") if l.startswith("data: ")]
    assert len(lines) >= 2
    last = json_module.loads(lines[-1].removeprefix("data: "))
    assert last["done"] is True
    assert len(last["full_response"]) > 10
