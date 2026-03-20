import json
import os
import pytest
from services.storage import save_result, get_result, save_upload, update_result


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "uploads"))
    return tmp_path


def _sample_result():
    return {
        "id": "20260320_143052",
        "timestamp": "2026-03-20T14:30:52",
        "filename": "aufnahme_20260320_143052.webm",
        "raw_transcript": "Der Patient hat Schmerzen im Ruecken.",
        "corrected_transcript": "Der Patient hat Schmerzen im Ruecken.",
        "summary": "## Anamnese\nRueckenschmerzen",
        "segments": [{"start": 0.0, "end": 5.2, "text": "Der Patient hat Schmerzen"}],
        "duration_seconds": 342.5,
        "processing_time": {
            "transcription": 145.2,
            "correction": 12.4,
            "summarization": 28.7,
        },
    }


def test_save_and_get_result(data_dir):
    result = _sample_result()
    result_id = save_result(result)
    assert result_id == "20260320_143052"

    loaded = get_result(result_id)
    assert loaded["raw_transcript"] == result["raw_transcript"]
    assert loaded["summary"] == result["summary"]
    assert loaded["segments"] == result["segments"]


def test_get_result_not_found(data_dir):
    loaded = get_result("nonexistent")
    assert loaded is None


def test_save_upload(data_dir):
    audio_bytes = b"fake audio content"
    path = save_upload(audio_bytes, "20260320_143052", "aufnahme.webm")
    assert os.path.exists(path)
    with open(path, "rb") as f:
        assert f.read() == audio_bytes


def test_update_result(data_dir):
    result = _sample_result()
    save_result(result)
    update_result("20260320_143052", {"summary": "Updated summary"})
    loaded = get_result("20260320_143052")
    assert loaded["summary"] == "Updated summary"
    assert loaded["raw_transcript"] == result["raw_transcript"]
