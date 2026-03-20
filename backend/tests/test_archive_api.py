import os
import json
import pytest
from services.storage import list_results, delete_result, search_results, save_result


@pytest.fixture(autouse=True)
def setup_data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "uploads"))
    os.makedirs(tmp_path / "data" / "results", exist_ok=True)
    os.makedirs(tmp_path / "uploads", exist_ok=True)


def _save_sample(result_id: str, summary: str = "Test summary", timestamp: str = "2026-03-20T10:00:00"):
    save_result({
        "id": result_id,
        "timestamp": timestamp,
        "filename": "test.webm",
        "raw_transcript": "raw text",
        "corrected_transcript": "corrected text",
        "summary": summary,
        "segments": [],
        "duration_seconds": 60.0,
        "processing_time": {"transcription": 1.0, "correction": 1.0, "summarization": 1.0},
    })


def test_list_results_empty():
    results = list_results()
    assert results == []


def test_list_results_returns_sorted():
    _save_sample("20260320_100000_aaa", timestamp="2026-03-20T10:00:00")
    _save_sample("20260320_110000_bbb", timestamp="2026-03-20T11:00:00")
    results = list_results()
    assert len(results) == 2
    assert results[0]["id"] == "20260320_110000_bbb"
    assert results[1]["id"] == "20260320_100000_aaa"
    assert "summary" in results[0]
    assert "timestamp" in results[0]


def test_delete_result():
    _save_sample("20260320_100000_aaa")
    assert delete_result("20260320_100000_aaa") is True
    assert list_results() == []


def test_delete_result_not_found():
    assert delete_result("nonexistent") is False


def test_search_results():
    _save_sample("20260320_100000_aaa", summary="Rotatorenmanschette Impingement")
    _save_sample("20260320_110000_bbb", summary="Kniegelenk Meniskus")
    results = search_results("Rotatorenmanschette")
    assert len(results) == 1
    assert results[0]["id"] == "20260320_100000_aaa"


def test_search_results_searches_transcript():
    _save_sample("20260320_100000_aaa", summary="kurz")
    from services.storage import get_result, _results_dir
    result = get_result("20260320_100000_aaa")
    result["raw_transcript"] = "Patient hat Schulterschmerzen"
    filepath = os.path.join(_results_dir(), "20260320_100000_aaa_result.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    results = search_results("Schulterschmerzen")
    assert len(results) == 1


from httpx import AsyncClient, ASGITransport
from app import app


@pytest.mark.asyncio
async def test_api_list_results():
    _save_sample("20260320_100000_aaa")
    _save_sample("20260320_110000_bbb")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/results")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["id"] == "20260320_110000_bbb"


@pytest.mark.asyncio
async def test_api_delete_result():
    _save_sample("20260320_100000_aaa")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.delete("/api/results/20260320_100000_aaa")
    assert response.status_code == 200
    assert response.json()["deleted"] is True


@pytest.mark.asyncio
async def test_api_delete_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.delete("/api/results/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_api_search_results():
    _save_sample("20260320_100000_aaa", summary="Rotatorenmanschette")
    _save_sample("20260320_110000_bbb", summary="Kniegelenk")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/results/search", params={"q": "Rotatorenmanschette"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "20260320_100000_aaa"
