import { useState, useRef, useCallback } from 'react'
import { startRecording as apiStartRecording, sendChunk, stopRecording as apiStopRecording } from '../services/api'
import type { ProcessingStartResponse } from '../types'

export type RecorderState = 'idle' | 'recording' | 'stopping'

interface UseRecorderReturn {
  state: RecorderState
  sessionId: string | null
  cumulativeText: string
  elapsedSeconds: number
  stream: MediaStream | null
  start: () => Promise<void>
  stop: () => Promise<ProcessingStartResponse>
  error: string | null
}

export function useRecorder(): UseRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cumulativeText, setCumulativeText] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const resolveStopRef = useRef<((value: ProcessingStartResponse) => void) | null>(null)
  const rejectStopRef = useRef<((reason: Error) => void) | null>(null)
  const lastChunkResolveRef = useRef<(() => void) | null>(null)

  const start = useCallback(async () => {
    try {
      setError(null)
      setCumulativeText('')
      setElapsedSeconds(0)
      chunksRef.current = []

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      setStream(mediaStream)

      const { session_id } = await apiStartRecording()
      setSessionId(session_id)
      sessionIdRef.current = session_id

      const recorder = new MediaRecorder(mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 64000,
      })
      recorderRef.current = recorder

      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          // Send chunk for live preview (skip if already stopping — chunk is still
          // captured above and will be included in the final audio blob)
          if (recorder.state === 'recording' && sessionIdRef.current) {
            try {
              const result = await sendChunk(sessionIdRef.current, event.data)
              setCumulativeText(result.cumulative_text)
            } catch {
              // Chunk preview failed — non-critical, continue recording
            }
          }
        }
        // Signal that the last chunk has been captured
        lastChunkResolveRef.current?.()
        lastChunkResolveRef.current = null
      }

      recorder.onstop = async () => {
        // Wait for the final ondataavailable event to fire and capture the last chunk
        await new Promise<void>((resolve) => {
          lastChunkResolveRef.current = resolve
        })

        const completeAudio = new Blob(chunksRef.current, { type: 'audio/webm' })
        mediaStream.getTracks().forEach((t) => t.stop())
        setStream(null)

        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        try {
          const response = await apiStopRecording(sessionIdRef.current!, completeAudio)
          setState('idle')
          resolveStopRef.current?.(response)
        } catch (err) {
          setState('idle')
          setError(err instanceof Error ? err.message : 'Stop failed')
          rejectStopRef.current?.(err instanceof Error ? err : new Error('Stop failed'))
        }
      }

      recorder.start(30000)
      setState('recording')

      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1)
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start recording')
      setState('idle')
    }
  }, [])

  const stop = useCallback((): Promise<ProcessingStartResponse> => {
    return new Promise((resolve, reject) => {
      resolveStopRef.current = resolve
      rejectStopRef.current = reject
      setState('stopping')
      recorderRef.current?.stop()
    })
  }, [])

  return { state, sessionId, cumulativeText, elapsedSeconds, stream, start, stop, error }
}
