import os
import tempfile
import pytest
from httpx import AsyncClient, ASGITransport

os.environ["USE_MOCKS"] = "true"

# Set temp dirs before importing app
_tmp = tempfile.mkdtemp()
os.environ["DATA_DIR"] = os.path.join(_tmp, "data")
os.environ["UPLOAD_DIR"] = os.path.join(_tmp, "uploads")

from app import app


@pytest.fixture
def transport():
    return ASGITransport(app=app)


async def test_health(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_recording_start(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post("/api/recording/start")
    assert r.status_code == 200
    data = r.json()
    assert "session_id" in data
    assert data["status"] == "recording"
    assert data["session_id"].startswith("rec_")


async def test_transcribe_chunk(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Start a session first
        start = await client.post("/api/recording/start")
        session_id = start.json()["session_id"]

        # Send a chunk
        r = await client.post(
            "/api/transcribe/chunk",
            files={"audio": ("chunk.webm", b"fake audio", "audio/webm")},
            data={"session_id": session_id},
        )
    assert r.status_code == 200
    data = r.json()
    assert "chunk_id" in data
    assert "text" in data
    assert "cumulative_text" in data


async def test_recording_stop_and_status(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Start session
        start = await client.post("/api/recording/start")
        session_id = start.json()["session_id"]

        # Stop with audio
        r = await client.post(
            "/api/recording/stop",
            files={"file": ("aufnahme.webm", b"fake complete audio", "audio/webm")},
            data={"session_id": session_id},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "processing"
        assert "message" in data

        # Poll until done (with timeout)
        import asyncio
        for _ in range(30):
            await asyncio.sleep(0.5)
            status_r = await client.get(f"/api/recording/{session_id}/status")
            status_data = status_r.json()
            if status_data["status"] == "done":
                break
        assert status_data["status"] == "done"
        assert "result_id" in status_data

        # Fetch result
        result_r = await client.get(f"/api/results/{status_data['result_id']}")
        assert result_r.status_code == 200
        result = result_r.json()
        assert "raw_transcript" in result
        assert "corrected_transcript" in result
        assert "summary" in result
        assert "segments" in result


async def test_process_upload(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post(
            "/api/process",
            files={"file": ("test.webm", b"fake audio", "audio/webm")},
        )
        assert r.status_code == 200
        data = r.json()
        assert "session_id" in data
        assert data["status"] == "processing"

        # Poll for result
        import asyncio
        for _ in range(30):
            await asyncio.sleep(0.5)
            status_r = await client.get(f"/api/recording/{data['session_id']}/status")
            status_data = status_r.json()
            if status_data["status"] == "done":
                break
        assert status_data["status"] == "done"


async def test_update_result(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a result via process
        r = await client.post(
            "/api/process",
            files={"file": ("test.webm", b"fake audio", "audio/webm")},
        )
        session_id = r.json()["session_id"]

        import asyncio
        for _ in range(30):
            await asyncio.sleep(0.5)
            sr = await client.get(f"/api/recording/{session_id}/status")
            sd = sr.json()
            if sd["status"] == "done":
                break

        result_id = sd["result_id"]

        # Update summary
        ur = await client.put(
            f"/api/results/{result_id}",
            json={"summary": "Edited summary"},
        )
        assert ur.status_code == 200

        # Verify update
        gr = await client.get(f"/api/results/{result_id}")
        assert gr.json()["summary"] == "Edited summary"
