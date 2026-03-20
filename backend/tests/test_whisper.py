import pytest
from mock_services.whisper_mock import transcribe_chunk, transcribe_full


async def test_transcribe_chunk_returns_text():
    result = await transcribe_chunk(b"fake audio bytes")
    assert isinstance(result, str)
    assert len(result) > 0


async def test_transcribe_full_returns_result():
    result = await transcribe_full("/fake/path.webm")
    assert "text" in result
    assert "segments" in result
    assert isinstance(result["segments"], list)
    assert len(result["segments"]) > 0
    assert "start" in result["segments"][0]
    assert "end" in result["segments"][0]
    assert "text" in result["segments"][0]
    assert "duration" in result
