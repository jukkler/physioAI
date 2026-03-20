import os
from dotenv import load_dotenv

load_dotenv()

WHISPER_API_URL = os.getenv("WHISPER_API_URL", "http://192.168.178.73:8100")
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://192.168.178.73:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen3.5:9b")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
DATA_DIR = os.getenv("DATA_DIR", "./data")
USE_MOCKS = os.getenv("USE_MOCKS", "false").lower() == "true"
