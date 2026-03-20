import pytest
from mock_services.llm_mock import correct_transcript, summarize_transcript


async def test_correct_transcript():
    result = await correct_transcript("Der Patient hat Schmerzen im Trapezius.")
    assert isinstance(result, str)
    assert len(result) > 0


async def test_summarize_transcript():
    result = await summarize_transcript("Patient klagt über Rückenschmerzen.")
    assert isinstance(result, str)
    assert "##" in result  # Should contain markdown headers
