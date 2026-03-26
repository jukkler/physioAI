import { useState } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import { useAudioMeter } from '../hooks/useAudioMeter'
import { uploadAudio } from '../services/api'
import { AudioMeter } from './AudioMeter'
import { FileUpload } from './FileUpload'

type DocType = 'befund' | 'verlauf'

interface RecordingViewProps {
  onProcessingStarted: (sessionId: string) => void
  onError: (error: string) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function RecordingView({ onProcessingStarted, onError }: RecordingViewProps) {
  const [docType, setDocType] = useState<DocType>('befund')
  const { state, cumulativeText, elapsedSeconds, stream, start, stop, error } = useRecorder()
  const level = useAudioMeter(stream)

  const handleStop = async () => {
    try {
      const response = await stop(docType)
      onProcessingStarted(response.session_id)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Stop failed')
    }
  }

  const handleFileSelected = async (file: File) => {
    try {
      const response = await uploadAudio(file, docType)
      onProcessingStarted(response.session_id)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Doc Type Toggle */}
      {state === 'idle' && (
        <div className="flex items-center justify-center gap-3">
          <span className={`text-sm font-medium ${docType === 'befund' ? 'text-blue-600' : 'text-gray-400'}`}>
            Befundung
          </span>
          <button
            onClick={() => setDocType(docType === 'befund' ? 'verlauf' : 'befund')}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              docType === 'verlauf' ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                docType === 'verlauf' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${docType === 'verlauf' ? 'text-blue-600' : 'text-gray-400'}`}>
            Verlaufsdoku
          </span>
        </div>
      )}

      {/* Record Button */}
      <div className="flex flex-col items-center gap-4">
        {state === 'idle' && (
          <button
            onClick={start}
            className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg"
          >
            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
        )}

        {state === 'recording' && (
          <>
            <button
              onClick={handleStop}
              className="w-24 h-24 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg animate-pulse"
            >
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
            <span className="text-2xl font-mono text-gray-700">{formatTime(elapsedSeconds)}</span>
            <AudioMeter level={level} />
          </>
        )}

        {state === 'stopping' && (
          <div className="text-gray-500">Aufnahme wird gestoppt...</div>
        )}

        <p className="text-sm text-gray-500">
          {state === 'idle' ? 'Aufnahme starten' : state === 'recording' ? 'Aufnahme laeuft...' : ''}
        </p>
      </div>

      {/* Live Preview */}
      {state === 'recording' && cumulativeText && (
        <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
          <p className="text-xs text-gray-400 mb-2">Live-Vorschau</p>
          <p className="text-sm text-gray-400 italic">{cumulativeText}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>
      )}

      {/* File Upload */}
      {state === 'idle' && (
        <FileUpload onFileSelected={handleFileSelected} />
      )}
    </div>
  )
}
