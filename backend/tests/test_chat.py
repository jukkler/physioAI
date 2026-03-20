import pytest
from services.factory import get_chat_service


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
