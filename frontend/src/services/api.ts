import type {
  RecordingStartResponse,
  ChunkResponse,
  ProcessingStartResponse,
  StatusResponse,
  Result,
  ResultSummary,
} from '../types'

const BASE = '/api'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${url}`, init)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.detail || error.error || `HTTP ${response.status}`)
  }
  return response.json()
}

export async function startRecording(): Promise<RecordingStartResponse> {
  return fetchJSON('/recording/start', { method: 'POST' })
}

export async function sendChunk(sessionId: string, audioBlob: Blob): Promise<ChunkResponse> {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'chunk.webm')
  formData.append('session_id', sessionId)
  return fetchJSON('/transcribe/chunk', { method: 'POST', body: formData })
}

export async function stopRecording(sessionId: string, audioBlob: Blob, docType: string = 'befund'): Promise<ProcessingStartResponse> {
  const formData = new FormData()
  formData.append('file', audioBlob, `aufnahme_${sessionId}.webm`)
  formData.append('session_id', sessionId)
  formData.append('doc_type', docType)
  return fetchJSON('/recording/stop', { method: 'POST', body: formData })
}

export async function uploadAudio(file: File, docType: string = 'befund'): Promise<ProcessingStartResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('doc_type', docType)
  return fetchJSON('/process', { method: 'POST', body: formData })
}

export async function getStatus(sessionId: string): Promise<StatusResponse> {
  return fetchJSON(`/recording/${sessionId}/status`)
}

export async function getResult(resultId: string): Promise<Result> {
  return fetchJSON(`/results/${resultId}`)
}

export async function updateResult(resultId: string, updates: { summary?: string; corrected_transcript?: string }): Promise<Result> {
  return fetchJSON(`/results/${resultId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
}

export async function listResults(): Promise<ResultSummary[]> {
  return fetchJSON('/results')
}

export async function deleteResult(resultId: string): Promise<{ deleted: boolean }> {
  return fetchJSON(`/results/${resultId}`, { method: 'DELETE' })
}

export async function searchResults(query: string): Promise<ResultSummary[]> {
  return fetchJSON(`/results/search?q=${encodeURIComponent(query)}`)
}

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
