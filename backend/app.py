import asyncio
import logging
import secrets
import time
from datetime import datetime

logger = logging.getLogger(__name__)

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import USE_MOCKS
from services.factory import get_whisper_service, get_llm_service
from services.storage import save_result, get_result, save_upload, update_result

app = FastAPI(title="PhysioDoc API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session state
sessions: dict[str, dict] = {}


def _generate_session_id() -> str:
    now = datetime.now()
    return f"rec_{now.strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(4)}"


def _result_id_from_session(session_id: str) -> str:
    # Remove "rec_" prefix, keep timestamp + random suffix
    return session_id[4:]


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/recording/start")
async def recording_start():
    session_id = _generate_session_id()
    sessions[session_id] = {
        "status": "recording",
        "cumulative_text": "",
        "chunk_count": 0,
        "steps": {
            "transcription": "pending",
            "correction": "pending",
            "summarization": "pending",
        },
        "result_id": None,
    }
    return {"session_id": session_id, "status": "recording"}


@app.post("/api/transcribe/chunk")
async def transcribe_chunk(
    audio: UploadFile = File(...),
    session_id: str = Form(...),
):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    whisper = get_whisper_service()
    audio_bytes = await audio.read()
    text = await whisper.transcribe_chunk(audio_bytes)

    session = sessions[session_id]
    session["chunk_count"] += 1
    session["cumulative_text"] += (" " + text if session["cumulative_text"] else text)

    return {
        "chunk_id": session["chunk_count"],
        "text": text,
        "cumulative_text": session["cumulative_text"],
    }


async def _run_pipeline(session_id: str, audio_bytes: bytes, filename: str):
    """Run transcription -> correction -> summarization in background."""
    session = sessions[session_id]
    result_id = _result_id_from_session(session_id)

    try:
        whisper = get_whisper_service()
        llm = get_llm_service()
        processing_time = {}

        # Save audio file
        audio_path = save_upload(audio_bytes, result_id, filename)

        # Step 1: Transcription
        session["steps"]["transcription"] = "processing"
        session["step"] = "transcription"
        t0 = time.time()
        transcript_result = await whisper.transcribe_full(audio_path)
        processing_time["transcription"] = round(time.time() - t0, 1)
        session["steps"]["transcription"] = "done"

        raw_transcript = transcript_result["text"]
        segments = transcript_result["segments"]
        duration = transcript_result["duration"]

        # Step 2: Correction
        session["steps"]["correction"] = "processing"
        session["step"] = "correction"
        t0 = time.time()
        corrected_transcript = await llm.correct_transcript(raw_transcript)
        processing_time["correction"] = round(time.time() - t0, 1)
        session["steps"]["correction"] = "done"

        # Step 3: Summarization
        session["steps"]["summarization"] = "processing"
        session["step"] = "summarization"
        t0 = time.time()
        summary = await llm.summarize_transcript(corrected_transcript)
        processing_time["summarization"] = round(time.time() - t0, 1)
        session["steps"]["summarization"] = "done"

        # Save result
        result = {
            "id": result_id,
            "timestamp": datetime.now().isoformat(),
            "filename": filename,
            "raw_transcript": raw_transcript,
            "corrected_transcript": corrected_transcript,
            "summary": summary,
            "segments": segments,
            "duration_seconds": duration,
            "processing_time": processing_time,
        }
        save_result(result)

        session["status"] = "done"
        session["result_id"] = result_id
    except Exception as e:
        logger.exception("Pipeline failed for session %s", session_id)
        session["status"] = "error"
        session["error"] = str(e)

    # Schedule session cleanup after 60 seconds
    async def _cleanup():
        await asyncio.sleep(60)
        sessions.pop(session_id, None)
    asyncio.create_task(_cleanup())


@app.post("/api/recording/stop")
async def recording_stop(
    file: UploadFile = File(...),
    session_id: str = Form(...),
):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]
    session["status"] = "processing"
    audio_bytes = await file.read()

    asyncio.create_task(_run_pipeline(session_id, audio_bytes, file.filename or "aufnahme.webm"))

    return {
        "session_id": session_id,
        "status": "processing",
        "message": "Verarbeitung gestartet...",
    }


@app.post("/api/process")
async def process_upload(file: UploadFile = File(...)):
    session_id = _generate_session_id()
    sessions[session_id] = {
        "status": "processing",
        "cumulative_text": "",
        "chunk_count": 0,
        "steps": {
            "transcription": "pending",
            "correction": "pending",
            "summarization": "pending",
        },
        "result_id": None,
    }

    audio_bytes = await file.read()
    asyncio.create_task(_run_pipeline(session_id, audio_bytes, file.filename or "upload.webm"))

    return {
        "session_id": session_id,
        "status": "processing",
        "message": "Verarbeitung gestartet...",
    }


@app.get("/api/recording/{session_id}/status")
async def recording_status(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]
    response = {
        "session_id": session_id,
        "status": session["status"],
        "steps": session["steps"],
    }

    if session["status"] == "processing":
        response["step"] = session.get("step", "pending")
    elif session["status"] == "done":
        response["result_id"] = session["result_id"]
    elif session["status"] == "error":
        response["error"] = session.get("error", "Unknown error")

    return response


@app.get("/api/results/{result_id}")
async def get_result_endpoint(result_id: str):
    result = get_result(result_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Result not found")
    return result


class ResultUpdate(BaseModel):
    summary: str | None = None
    corrected_transcript: str | None = None


@app.put("/api/results/{result_id}")
async def update_result_endpoint(result_id: str, updates: ResultUpdate):
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    result = update_result(result_id, update_data)
    if result is None:
        raise HTTPException(status_code=404, detail="Result not found")
    return result
