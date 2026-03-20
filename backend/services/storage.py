import json
import os


def _results_dir() -> str:
    data_dir = os.environ.get("DATA_DIR", "./data")
    path = os.path.join(data_dir, "results")
    os.makedirs(path, exist_ok=True)
    return path


def _uploads_dir() -> str:
    upload_dir = os.environ.get("UPLOAD_DIR", "./uploads")
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


def save_result(result: dict) -> str:
    result_id = result["id"]
    filepath = os.path.join(_results_dir(), f"{result_id}_result.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return result_id


def get_result(result_id: str) -> dict | None:
    filepath = os.path.join(_results_dir(), f"{result_id}_result.json")
    if not os.path.exists(filepath):
        return None
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def update_result(result_id: str, updates: dict) -> dict | None:
    result = get_result(result_id)
    if result is None:
        return None
    result.update(updates)
    save_result(result)
    return result


def save_upload(audio_bytes: bytes, session_id: str, filename: str) -> str:
    safe_name = f"{session_id}_{os.path.basename(filename)}"
    filepath = os.path.join(_uploads_dir(), safe_name)
    with open(filepath, "wb") as f:
        f.write(audio_bytes)
    return filepath
