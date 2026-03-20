# PhysioDoc Phase 2 — Archiv + Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tab-Navigation with three tabs: Aufnahme (existing Phase 1), Verlauf/Archiv (browse/search/delete past results), and Assistent (streaming chat with Ollama).

**Architecture:** The App.tsx state machine is refactored into a tab-based layout. Tab 1 keeps existing recording flow. Tab 3 (Archiv) reads JSON results from filesystem via new list/search/delete endpoints. Tab 2 (Chat) uses Ollama's `/api/chat` endpoint with SSE-style streaming, rendered token-by-token. Backend adds 4 new endpoints (list, delete, search results + chat). Mock services extended for offline dev.

**Tech Stack:** FastAPI, React 18 + TypeScript, Tailwind CSS, Ollama streaming API (`/api/chat`)

---

## File Structure

### Backend — New Files

| File | Responsibility |
|---|---|
| `backend/services/chat.py` | Ollama `/api/chat` streaming client — async generator yielding tokens |
| `backend/mock_services/chat_mock.py` | Mock chat service with fake streaming tokens |
| `backend/tests/test_chat.py` | Tests for chat mock service |
| `backend/tests/test_archive_api.py` | Tests for list/search/delete endpoints |

### Backend — Modified Files

| File | Changes |
|---|---|
| `backend/app.py` | Add 4 endpoints: `GET /api/results` (list), `DELETE /api/results/{id}` (delete), `GET /api/results/search` (search), `POST /api/chat` (streaming) |
| `backend/services/storage.py` | Add `list_results()`, `delete_result()`, `search_results(query)` |
| `backend/services/factory.py` | Add `get_chat_service()` |
| `backend/prompts.py` | Add `CHAT_SYSTEM_PROMPT` |

### Frontend — New Files

| File | Responsibility |
|---|---|
| `frontend/src/components/TabNav.tsx` | Top-level tab navigation (Aufnahme, Assistent, Verlauf) |
| `frontend/src/components/ArchiveView.tsx` | Results list, search, delete confirmation |
| `frontend/src/components/ArchiveDetail.tsx` | Full result view from archive (reuses ResultView display) |
| `frontend/src/components/ChatView.tsx` | Chat interface: message list, input, streaming response, prompt chips |

### Frontend — Modified Files

| File | Changes |
|---|---|
| `frontend/src/App.tsx` | Replace flat state machine with tab layout; Tab 1 = existing recording flow, Tab 2 = ChatView, Tab 3 = ArchiveView |
| `frontend/src/services/api.ts` | Add `listResults()`, `deleteResult()`, `searchResults()`, `sendChatMessage()` (streaming) |
| `frontend/src/types.ts` | Add `ResultSummary`, `ChatMessage` interfaces |

---

## Part A: Archiv (Tab 3)

### Task 1: Backend — Storage list/search/delete functions

**Files:**
- Modify: `backend/services/storage.py`
- Create: `backend/tests/test_archive_api.py`

- [ ] **Step 1: Write the failing tests**

In `backend/tests/test_archive_api.py`:

```python
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
    # Newest first
    assert results[0]["id"] == "20260320_110000_bbb"
    assert results[1]["id"] == "20260320_100000_aaa"
    # Should include summary preview fields
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
    # Manually update the raw_transcript to contain the search term
    from services.storage import get_result, _results_dir
    result = get_result("20260320_100000_aaa")
    result["raw_transcript"] = "Patient hat Schulterschmerzen"
    filepath = os.path.join(_results_dir(), "20260320_100000_aaa_result.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    results = search_results("Schulterschmerzen")
    assert len(results) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_archive_api.py -v`
Expected: FAIL — `list_results`, `delete_result`, `search_results` not defined

- [ ] **Step 3: Implement storage functions**

Add to `backend/services/storage.py`:

```python
def list_results() -> list[dict]:
    results_dir = _results_dir()
    results = []
    for filename in os.listdir(results_dir):
        if filename.endswith("_result.json"):
            filepath = os.path.join(results_dir, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                results.append(json.load(f))
    results.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    return results


def delete_result(result_id: str) -> bool:
    filepath = os.path.join(_results_dir(), f"{result_id}_result.json")
    if not os.path.exists(filepath):
        return False
    os.remove(filepath)
    # Also delete audio file if exists
    uploads_dir = _uploads_dir()
    for f in os.listdir(uploads_dir):
        if f.startswith(result_id):
            os.remove(os.path.join(uploads_dir, f))
    return True


def search_results(query: str) -> list[dict]:
    query_lower = query.lower()
    matches = []
    for result in list_results():
        searchable = " ".join([
            result.get("summary", ""),
            result.get("corrected_transcript", ""),
            result.get("raw_transcript", ""),
        ]).lower()
        if query_lower in searchable:
            matches.append(result)
    return matches
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_archive_api.py -v`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/storage.py backend/tests/test_archive_api.py
git commit -m "feat: add list, delete, search functions to storage service"
```

---

### Task 2: Backend — Archive API endpoints

**Files:**
- Modify: `backend/app.py`
- Modify: `backend/tests/test_archive_api.py`

- [ ] **Step 1: Add API endpoint tests**

Append to `backend/tests/test_archive_api.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_archive_api.py::test_api_list_results -v`
Expected: FAIL — 405 Method Not Allowed (GET /api/results doesn't exist yet)

- [ ] **Step 3: Add endpoints to app.py**

Update the import at the top of `app.py`:

```python
from services.storage import save_result, get_result, save_upload, update_result, list_results, delete_result, search_results
```

**Critical: Route ordering.** FastAPI matches routes in declaration order. `GET /api/results/search` MUST be declared BEFORE `GET /api/results/{result_id}`, otherwise FastAPI treats "search" as a `result_id`.

Reorganize the results routes in `app.py` so they appear in this exact order (replacing the existing `get_result_endpoint` and `update_result_endpoint`):

```python
@app.get("/api/results")
async def list_results_endpoint():
    return list_results()


@app.get("/api/results/search")
async def search_results_endpoint(q: str):
    if not q.strip():
        return []
    return search_results(q)


@app.get("/api/results/{result_id}")
async def get_result_endpoint(result_id: str):
    result = get_result(result_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Result not found")
    return result


@app.put("/api/results/{result_id}")
async def update_result_endpoint(result_id: str, updates: ResultUpdate):
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    result = update_result(result_id, update_data)
    if result is None:
        raise HTTPException(status_code=404, detail="Result not found")
    return result


@app.delete("/api/results/{result_id}")
async def delete_result_endpoint(result_id: str):
    if not delete_result(result_id):
        raise HTTPException(status_code=404, detail="Result not found")
    return {"deleted": True, "id": result_id}
```

- [ ] **Step 4: Run all archive tests**

Run: `cd backend && python -m pytest tests/test_archive_api.py -v`
Expected: All 10 tests PASS

- [ ] **Step 5: Run full backend test suite**

Run: `cd backend && python -m pytest -v`
Expected: All tests PASS (existing + new)

- [ ] **Step 6: Commit**

```bash
git add backend/app.py backend/tests/test_archive_api.py
git commit -m "feat: add list, delete, search API endpoints for archive"
```

---

### Task 3: Frontend — Types and API client for archive

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add ResultSummary type**

Add to `frontend/src/types.ts`:

```typescript
export interface ResultSummary {
  id: string
  timestamp: string
  filename: string
  summary: string
  duration_seconds: number
}
```

- [ ] **Step 2: Add API functions**

Add `ResultSummary` to the existing import block at the top of `frontend/src/services/api.ts` (line 1-7):

```typescript
import type {
  RecordingStartResponse,
  ChunkResponse,
  ProcessingStartResponse,
  StatusResponse,
  Result,
  ResultSummary,
} from '../types'
```

Then add these functions at the end of the file:

```typescript
export async function listResults(): Promise<ResultSummary[]> {
  return fetchJSON('/results')
}

export async function deleteResult(resultId: string): Promise<{ deleted: boolean }> {
  return fetchJSON(`/results/${resultId}`, { method: 'DELETE' })
}

export async function searchResults(query: string): Promise<ResultSummary[]> {
  return fetchJSON(`/results/search?q=${encodeURIComponent(query)}`)
}
```

Also update the existing `updateResult` function to accept `corrected_transcript`:

```typescript
export async function updateResult(resultId: string, updates: { summary?: string; corrected_transcript?: string }): Promise<Result> {
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts frontend/src/services/api.ts
git commit -m "feat: add archive types and API client functions"
```

---

### Task 4: Frontend — Tab navigation

**Files:**
- Create: `frontend/src/components/TabNav.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create TabNav component**

Create `frontend/src/components/TabNav.tsx`:

```tsx
type Tab = 'recording' | 'chat' | 'archive'

interface TabNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'recording', label: 'Aufnahme' },
  { key: 'chat', label: 'Assistent' },
  { key: 'archive', label: 'Verlauf' },
]

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav className="flex border-b bg-white">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab.key
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

export type { Tab }
```

- [ ] **Step 2: Refactor App.tsx to use tabs**

Rewrite `frontend/src/App.tsx`:

```tsx
import { useState, useCallback, useEffect } from 'react'
import { TabNav } from './components/TabNav'
import type { Tab } from './components/TabNav'
import { RecordingView } from './components/RecordingView'
import { ProcessingStatus } from './components/ProcessingStatus'
import { ResultView } from './components/ResultView'
import { ArchiveView } from './components/ArchiveView'
import { getResult, getStatus } from './services/api'
import type { Result } from './types'

type RecordingState = 'idle' | 'processing' | 'result' | 'error'

const SESSION_KEY = 'physiodoc_session_id'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('recording')

  // Recording tab state
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const savedSessionId = localStorage.getItem(SESSION_KEY)
    if (!savedSessionId) return

    getStatus(savedSessionId)
      .then((status) => {
        if (status.status === 'processing') {
          setSessionId(savedSessionId)
          setRecordingState('processing')
        } else if (status.status === 'done' && status.result_id) {
          localStorage.removeItem(SESSION_KEY)
          return getResult(status.result_id).then((r) => {
            setResult(r)
            setRecordingState('result')
          })
        } else if (status.status === 'error') {
          localStorage.removeItem(SESSION_KEY)
          setError(status.error ?? 'Verarbeitung fehlgeschlagen')
          setRecordingState('error')
        }
      })
      .catch(() => {
        localStorage.removeItem(SESSION_KEY)
      })
  }, [])

  const handleProcessingStarted = useCallback((sid: string) => {
    localStorage.setItem(SESSION_KEY, sid)
    setSessionId(sid)
    setRecordingState('processing')
    setError(null)
  }, [])

  const handleDone = useCallback(async (resultId: string) => {
    localStorage.removeItem(SESSION_KEY)
    try {
      const r = await getResult(resultId)
      setResult(r)
      setRecordingState('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load result')
      setRecordingState('error')
    }
  }, [])

  const handleError = useCallback((msg: string) => {
    localStorage.removeItem(SESSION_KEY)
    setError(msg)
    setRecordingState('error')
  }, [])

  const handleNewRecording = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setRecordingState('idle')
    setSessionId(null)
    setResult(null)
    setError(null)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/favicon.svg" alt="PhysioDoc" className="h-8 w-auto" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PhysioDoc</h1>
            <p className="text-sm text-gray-500">Behandlungsdokumentation</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto">
        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {activeTab === 'recording' && (
          <>
            {recordingState === 'idle' && (
              <RecordingView
                onProcessingStarted={handleProcessingStarted}
                onError={handleError}
              />
            )}
            {recordingState === 'processing' && sessionId && (
              <ProcessingStatus
                sessionId={sessionId}
                onDone={handleDone}
                onError={handleError}
              />
            )}
            {recordingState === 'result' && result && (
              <ResultView result={result} onNewRecording={handleNewRecording} />
            )}
            {recordingState === 'error' && (
              <div className="text-center space-y-4">
                <div className="bg-red-50 text-red-700 rounded-lg p-4">
                  {error || 'Ein unbekannter Fehler ist aufgetreten.'}
                </div>
                <button
                  onClick={handleNewRecording}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                >
                  Erneut versuchen
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'chat' && (
          <div className="text-center text-gray-500 py-12">Chat — wird in Task 8-11 implementiert</div>
        )}

        {activeTab === 'archive' && (
          <ArchiveView />
        )}
      </main>
    </div>
  )
}

export default App
```

- [ ] **Step 3: Create placeholder ArchiveView**

Create `frontend/src/components/ArchiveView.tsx`:

```tsx
export function ArchiveView() {
  return <div className="text-center text-gray-500 py-12">Archiv wird geladen...</div>
}
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TabNav.tsx frontend/src/components/ArchiveView.tsx frontend/src/App.tsx
git commit -m "feat: add tab navigation with Aufnahme, Assistent, Verlauf tabs"
```

---

### Task 5: Frontend — ArchiveView component

**Files:**
- Modify: `frontend/src/components/ArchiveView.tsx`

- [ ] **Step 1: Implement ArchiveView**

Write `frontend/src/components/ArchiveView.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { listResults, searchResults, deleteResult, getResult } from '../services/api'
import { ResultView } from './ResultView'
import type { Result, ResultSummary } from '../types'

export function ArchiveView() {
  const [results, setResults] = useState<ResultSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedResult, setSelectedResult] = useState<Result | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const loadResults = useCallback(async () => {
    setLoading(true)
    try {
      const data = searchQuery.trim()
        ? await searchResults(searchQuery.trim())
        : await listResults()
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  useEffect(() => {
    loadResults()
  }, [loadResults])

  const handleDelete = async (id: string) => {
    await deleteResult(id)
    setDeleteConfirm(null)
    if (selectedResult?.id === id) setSelectedResult(null)
    loadResults()
  }

  const handleOpen = async (id: string) => {
    const full = await getResult(id)
    setSelectedResult(full)
  }

  if (selectedResult) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedResult(null)}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          &larr; Zurueck zur Liste
        </button>
        <ResultView
          result={selectedResult}
          onNewRecording={() => setSelectedResult(null)}
        />
      </div>
    )
  }

  const formatDate = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60)
    const sec = Math.round(seconds % 60)
    return `${min}:${sec.toString().padStart(2, '0')} min`
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Dokumentationen durchsuchen..."
          className="w-full px-4 py-2 pl-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Results list */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">Laden...</div>
      ) : results.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          {searchQuery ? 'Keine Ergebnisse gefunden.' : 'Noch keine Dokumentationen vorhanden.'}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((r) => (
            <div
              key={r.id}
              className="bg-white border rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <button
                  onClick={() => handleOpen(r.id)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-medium text-gray-900">{formatDate(r.timestamp)}</span>
                    <span className="text-xs text-gray-400">{formatDuration(r.duration_seconds)}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {r.summary.split('\n').find((line: string) => line.trim() && !line.startsWith('#')) || r.filename}
                  </p>
                </button>

                <div className="ml-4 flex-shrink-0">
                  {deleteConfirm === r.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Loeschen
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(r.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="Loeschen"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ArchiveView.tsx
git commit -m "feat: implement archive view with list, search, delete, detail"
```

---

## Part B: Chat/Assistent (Tab 2)

### Task 6: Backend — Chat system prompt

**Files:**
- Modify: `backend/prompts.py`

- [ ] **Step 1: Add chat system prompt**

Add to `backend/prompts.py`:

```python
CHAT_SYSTEM_PROMPT = """Du bist ein KI-Assistent für eine Physiotherapie-Praxis.
Du hilfst bei:
- Formulierung von Übungsanleitungen für Patienten
- Differentialdiagnostik bei muskuloskeletalen Beschwerden
- Verfassen von Berichten an Ärzte und Kostenträger
- Erklärung von Befunden und Behandlungsansätzen
- Allgemeinen Fragen rund um Physiotherapie

Antworte auf Deutsch. Verwende korrekte medizinische/physiotherapeutische
Fachterminologie. Weise darauf hin, wenn eine Frage außerhalb deines
Kompetenzbereichs liegt."""
```

- [ ] **Step 2: Commit**

```bash
git add backend/prompts.py
git commit -m "feat: add chat system prompt for physio assistant"
```

---

### Task 7: Backend — Chat service (streaming)

**Files:**
- Create: `backend/services/chat.py`
- Create: `backend/mock_services/chat_mock.py`
- Modify: `backend/services/factory.py`
- Create: `backend/tests/test_chat.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_chat.py`:

```python
import pytest
from services.factory import get_chat_service


@pytest.fixture(autouse=True)
def use_mocks(monkeypatch):
    monkeypatch.setenv("USE_MOCKS", "true")


@pytest.mark.asyncio
async def test_chat_stream_yields_tokens():
    chat = get_chat_service()
    messages = [{"role": "user", "content": "Was ist ein Lasègue-Test?"}]
    tokens = []
    async for token in chat.stream_chat(messages):
        tokens.append(token)
    assert len(tokens) > 0
    full_text = "".join(tokens)
    assert len(full_text) > 10
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_chat.py -v`
Expected: FAIL — `get_chat_service` not defined

- [ ] **Step 3: Create mock chat service**

Create `backend/mock_services/chat_mock.py`:

```python
import asyncio
from typing import AsyncGenerator


MOCK_RESPONSE = "Der Lasègue-Test ist ein klinischer Provokationstest zur Überprüfung einer Nervenwurzelreizung (Radikulopathie) im Bereich der Lendenwirbelsäule. Der Patient liegt in Rückenlage, der Untersucher hebt das gestreckte Bein passiv an. Der Test ist positiv bei ausstrahlenden Schmerzen im Verlauf des N. ischiadicus zwischen 30° und 70° Beugung."

async def stream_chat(messages: list[dict]) -> AsyncGenerator[str, None]:
    words = MOCK_RESPONSE.split(" ")
    for word in words:
        await asyncio.sleep(0.05)
        yield word + " "
```

- [ ] **Step 4: Create real chat service**

Create `backend/services/chat.py`:

```python
import json
from typing import AsyncGenerator

import httpx
from config import OLLAMA_API_URL, LLM_MODEL
from prompts import CHAT_SYSTEM_PROMPT

TIMEOUT = 300.0


async def stream_chat(messages: list[dict]) -> AsyncGenerator[str, None]:
    full_messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}] + messages
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream(
            "POST",
            f"{OLLAMA_API_URL}/api/chat",
            json={
                "model": LLM_MODEL,
                "messages": full_messages,
                "stream": True,
                "think": False,
                "options": {
                    "temperature": 0.5,
                    "num_ctx": 4096,
                    "num_predict": 2048,
                },
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                data = json.loads(line)
                if data.get("done"):
                    break
                content = data.get("message", {}).get("content", "")
                if content:
                    yield content
```

- [ ] **Step 5: Update factory.py**

Add to `backend/services/factory.py`:

```python
def get_chat_service():
    if USE_MOCKS:
        from mock_services import chat_mock
        return chat_mock
    from services import chat
    return chat
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_chat.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/services/chat.py backend/mock_services/chat_mock.py backend/services/factory.py backend/tests/test_chat.py
git commit -m "feat: add streaming chat service with mock"
```

---

### Task 8: Backend — Chat API endpoint

**Files:**
- Modify: `backend/app.py`

- [ ] **Step 1: Add chat endpoint**

Add to `backend/app.py`:

Add `import json` and `from fastapi.responses import StreamingResponse` to the top of `app.py`. Also add `get_chat_service` to the factory import. Then add:

```python
class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    chat = get_chat_service()
    messages = request.history + [{"role": "user", "content": request.message}]

    async def event_stream():
        full_response = ""
        async for token in chat.stream_chat(messages):
            full_response += token
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield f"data: {json.dumps({'done': True, 'full_response': full_response})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

- [ ] **Step 2: Add HTTP-level test for the chat SSE endpoint**

Add to `backend/tests/test_chat.py`:

```python
from httpx import AsyncClient, ASGITransport
from app import app
import json


@pytest.mark.asyncio
async def test_chat_api_streams_sse():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/chat",
            json={"message": "Was ist ein Lasègue-Test?", "history": []},
        )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    lines = [l for l in response.text.strip().split("\n") if l.startswith("data: ")]
    assert len(lines) >= 2  # at least one token + done
    last = json.loads(lines[-1].removeprefix("data: "))
    assert last["done"] is True
    assert len(last["full_response"]) > 10
```

- [ ] **Step 3: Verify all tests pass**

Run: `cd backend && python -m pytest -v`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app.py backend/tests/test_chat.py
git commit -m "feat: add streaming chat API endpoint"
```

---

### Task 9: Frontend — Chat types and API client

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add ChatMessage type**

Add to `frontend/src/types.ts`:

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
```

- [ ] **Step 2: Add streaming chat API function**

Add to `frontend/src/services/api.ts`:

```typescript
export async function sendChatMessage(
  message: string,
  history: { role: string; content: string }[],
  onToken: (token: string) => void,
  onDone: (fullResponse: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
    signal,
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = JSON.parse(line.slice(6))
      if (data.done) {
        onDone(data.full_response)
        return
      }
      if (data.token) {
        onToken(data.token)
      }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts frontend/src/services/api.ts
git commit -m "feat: add chat types and streaming API client"
```

---

### Task 10: Frontend — ChatView component

**Files:**
- Create: `frontend/src/components/ChatView.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create ChatView**

Create `frontend/src/components/ChatView.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react'
import { sendChatMessage } from '../services/api'
import type { ChatMessage } from '../types'

const SUGGESTED_PROMPTS = [
  'Uebungsanleitung fuer Patienten erstellen',
  'Differentialdiagnosen zu...',
  'E-Mail an Ueberweiser formulieren',
  'Behandlungsbericht erstellen',
]

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = async (text?: string) => {
    const message = text || input.trim()
    if (!message || streaming) return

    const userMessage: ChatMessage = { role: 'user', content: message }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)
    setStreamingContent('')

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      await sendChatMessage(
        message,
        history,
        (token) => {
          setStreamingContent((prev) => prev + token)
        },
        (fullResponse) => {
          setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }])
          setStreamingContent('')
          setStreaming(false)
        },
        abortController.signal,
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Fehler: Antwort konnte nicht geladen werden.' },
        ])
      }
      setStreamingContent('')
      setStreaming(false)
    }
  }

  const handleClear = () => {
    if (abortRef.current) abortRef.current.abort()
    setMessages([])
    setStreamingContent('')
    setStreaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && !streaming && (
          <div className="text-center py-12 space-y-6">
            <p className="text-gray-500">Wie kann ich dir helfen?</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="px-3 py-1.5 text-sm bg-white border rounded-full text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border text-gray-800'
              }`}
            >
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
            </div>
          </div>
        ))}

        {streaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 text-sm bg-white border text-gray-800">
              <pre className="whitespace-pre-wrap font-sans">{streamingContent}</pre>
              <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht eingeben..."
            rows={1}
            className="flex-1 px-4 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || streaming}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Senden
          </button>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              title="Chat loeschen"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire ChatView into App.tsx**

Replace the chat placeholder in `App.tsx`:

```tsx
import { ChatView } from './components/ChatView'
```

Replace:
```tsx
{activeTab === 'chat' && (
  <div className="text-center text-gray-500 py-12">Chat — wird in Task 8-11 implementiert</div>
)}
```

With:
```tsx
{activeTab === 'chat' && <ChatView />}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatView.tsx frontend/src/App.tsx
git commit -m "feat: implement chat view with streaming responses"
```

---

## Part C: Final Integration

### Task 11: Full test suite + build verification

**Files:** None (verification only)

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && python -m pytest -v`
Expected: All tests PASS (existing Phase 1 tests + new archive + chat tests)

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: Clean build, no errors

- [ ] **Step 3: Commit any remaining changes**

If any fixes were needed, commit them:

```bash
git add -A
git commit -m "fix: resolve integration issues from Phase 2"
```

---

### Task 12: E2E smoke test

- [ ] **Step 1: Start backend with mocks**

```bash
cd backend && USE_MOCKS=true python -m uvicorn app:app --host 0.0.0.0 --port 8080
```

- [ ] **Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Test Tab Navigation**

Open http://localhost:5173. Verify:
- Three tabs visible: Aufnahme, Assistent, Verlauf
- Clicking tabs switches content
- Active tab is highlighted

- [ ] **Step 4: Test Aufnahme tab (regression)**

- Record → live preview → stop → processing → result should still work
- Upload should still work

- [ ] **Step 5: Test Verlauf tab**

- Previous results appear in list (sorted newest first)
- Search filters results
- Click opens detail view with back button
- Delete shows confirmation, deletes entry

- [ ] **Step 6: Test Assistent tab**

- Suggested prompts appear when empty
- Click prompt chip → sends message
- Streaming response appears token by token
- Chat history maintained
- Clear button resets chat
- Enter sends, Shift+Enter adds newline
