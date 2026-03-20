# PhysioDoc

Lokale Web-App fuer Physiotherapie-Praxen. Behandlungsgespraeche aufnehmen, transkribieren (Faster-Whisper), Fachbegriffe korrigieren und strukturierte Dokumentation generieren (Ollama/Qwen3.5) — alles lokal, keine Cloud.

## Features

- **Live-Aufnahme** mit Mikrofon, Pegel-Anzeige und Echtzeit-Transkript-Vorschau
- **Datei-Upload** per Drag & Drop (MP3, WAV, M4A, OGG, WEBM)
- **3-Schritt-Pipeline**: Transkription → Fachbegriff-Korrektur → strukturierte Zusammenfassung
- **Ergebnis-Ansicht** mit 3 Tabs (Zusammenfassung, korrigiertes Transkript, Roh-Transkript)
- **Inline-Editing** der Zusammenfassung direkt im Browser
- **Offline-Entwicklung** mit Mock-Services (`USE_MOCKS=true`)

## Tech Stack

| Komponente | Technologie |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | FastAPI (Python), uvicorn |
| STT | Faster-Whisper (OpenAI-kompatible API) |
| LLM | Ollama mit Qwen3.5:9b |
| Speicher | JSON-Dateien (kein Datenbank-Setup noetig) |

## Voraussetzungen

- Python 3.12+
- Node.js 20+
- [Faster-Whisper Server](https://github.com/fedirz/faster-whisper-server) (fuer STT)
- [Ollama](https://ollama.ai/) mit `qwen3.5:9b` Modell (fuer LLM)

Fuer die Entwicklung ohne externe Services: `USE_MOCKS=true` in `.env` setzen.

## Setup

```bash
# Repository klonen
git clone https://github.com/jukkler/physioAI.git
cd physioAI

# Umgebungsvariablen konfigurieren
cp .env.example .env
# .env anpassen (Server-IPs, Modell, etc.)

# Backend
cd backend
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
npm install
cd ..
```

## Starten

```bash
# Terminal 1: Backend
cd backend
uvicorn app:app --host 0.0.0.0 --port 8080

# Terminal 2: Frontend
cd frontend
npm run dev
```

Frontend: http://localhost:5173
Backend-API: http://localhost:8080/docs

## Entwicklung mit Mocks

Ohne Whisper/Ollama-Server entwickeln:

```bash
# In .env setzen:
USE_MOCKS=true
```

Die Mock-Services geben realistische Physio-Texte nach kurzer Verzoegerung zurueck.

## Tests

```bash
cd backend
pytest tests/ -v
```

## Umgebungsvariablen

| Variable | Beschreibung | Standard |
|---|---|---|
| `WHISPER_API_URL` | Faster-Whisper Server URL | `http://192.168.178.73:8100` |
| `OLLAMA_API_URL` | Ollama Server URL | `http://192.168.178.73:11434` |
| `LLM_MODEL` | Ollama Modell | `qwen3.5:9b` |
| `UPLOAD_DIR` | Pfad fuer Audio-Uploads | `./uploads` |
| `DATA_DIR` | Pfad fuer Ergebnis-JSON | `./data` |
| `USE_MOCKS` | Mock-Services aktivieren | `false` |

## API-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/health` | Health Check |
| POST | `/api/recording/start` | Aufnahme-Session starten |
| POST | `/api/transcribe/chunk` | Audio-Chunk transkribieren (Live-Vorschau) |
| POST | `/api/recording/stop` | Aufnahme stoppen, Pipeline starten |
| POST | `/api/process` | Audio-Datei hochladen und verarbeiten |
| GET | `/api/recording/{session_id}/status` | Verarbeitungsfortschritt abfragen |
| GET | `/api/results/{id}` | Ergebnis abrufen |
| PUT | `/api/results/{id}` | Zusammenfassung bearbeiten |

## Projektstruktur

```
physioAI/
├── frontend/
│   └── src/
│       ├── components/       # React-Komponenten (RecordingView, ResultView, ...)
│       ├── hooks/            # useRecorder, useAudioMeter
│       └── services/         # API-Client
├── backend/
│   ├── app.py                # FastAPI App + Routen
│   ├── services/             # Whisper, LLM, Storage
│   ├── mock_services/        # Fake-Services fuer Offline-Dev
│   ├── prompts.py            # Korrektur- und Zusammenfassungs-Prompts
│   └── tests/
└── docs/                     # Specs und Plaene
```

## Lizenz

Privat
