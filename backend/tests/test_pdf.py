import pytest
from services.pdf import generate_pdf


def test_generate_pdf_returns_bytes():
    result = {
        "id": "20260320_100000_aaa",
        "timestamp": "2026-03-20T10:00:00",
        "filename": "test.webm",
        "raw_transcript": "Roh text",
        "corrected_transcript": "Korrigierter text",
        "summary": "## Patienteninformation\n- Name: Max Mustermann\n\n## Anamnese\n- Schulterschmerzen rechts",
        "segments": [],
        "duration_seconds": 120.0,
        "processing_time": {"transcription": 1.0, "correction": 1.0, "summarization": 1.0},
    }
    pdf_bytes = generate_pdf(result)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 100
    assert pdf_bytes[:4] == b"%PDF"


def test_generate_pdf_handles_umlauts():
    result = {
        "id": "20260320_100000_bbb",
        "timestamp": "2026-03-20T11:00:00",
        "filename": "test.webm",
        "raw_transcript": "Übung für Rücken",
        "corrected_transcript": "Übung für Rücken",
        "summary": "## Übungsanleitung\n- Kräftigung der Rotatorenmanschette\n- Dehnübungen für M. piriformis",
        "segments": [],
        "duration_seconds": 60.0,
        "processing_time": {"transcription": 1.0, "correction": 1.0, "summarization": 1.0},
    }
    pdf_bytes = generate_pdf(result)
    assert pdf_bytes[:4] == b"%PDF"
