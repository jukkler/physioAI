export interface RecordingStartResponse {
  session_id: string
  status: 'recording'
}

export interface ChunkResponse {
  chunk_id: number
  text: string
  cumulative_text: string
}

export interface ProcessingStartResponse {
  session_id: string
  status: 'processing'
  message: string
}

export interface ProcessingStep {
  transcription: 'pending' | 'processing' | 'done'
  correction: 'pending' | 'processing' | 'done'
  summarization: 'pending' | 'processing' | 'done'
}

export interface StatusResponse {
  session_id: string
  status: 'recording' | 'processing' | 'done' | 'error'
  step?: string
  steps?: ProcessingStep
  result_id?: string
  error?: string
}

export interface Segment {
  start: number
  end: number
  text: string
}

export interface Result {
  id: string
  timestamp: string
  filename: string
  raw_transcript: string
  corrected_transcript: string
  summary: string
  segments: Segment[]
  duration_seconds: number
  processing_time: {
    transcription: number
    correction: number
    summarization: number
  }
}

export interface ResultSummary {
  id: string
  timestamp: string
  filename: string
  summary: string
  duration_seconds: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
