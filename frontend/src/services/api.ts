import type {
  RecordingStartResponse,
  ChunkResponse,
  ProcessingStartResponse,
  StatusResponse,
  Result,
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

export async function stopRecording(sessionId: string, audioBlob: Blob): Promise<ProcessingStartResponse> {
  const formData = new FormData()
  formData.append('file', audioBlob, `aufnahme_${sessionId}.webm`)
  formData.append('session_id', sessionId)
  return fetchJSON('/recording/stop', { method: 'POST', body: formData })
}

export async function uploadAudio(file: File): Promise<ProcessingStartResponse> {
  const formData = new FormData()
  formData.append('file', file)
  return fetchJSON('/process', { method: 'POST', body: formData })
}

export async function getStatus(sessionId: string): Promise<StatusResponse> {
  return fetchJSON(`/recording/${sessionId}/status`)
}

export async function getResult(resultId: string): Promise<Result> {
  return fetchJSON(`/results/${resultId}`)
}

export async function updateResult(resultId: string, updates: { summary?: string }): Promise<Result> {
  return fetchJSON(`/results/${resultId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
}
