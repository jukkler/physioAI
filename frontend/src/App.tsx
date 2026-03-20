import { useState, useCallback, useEffect } from 'react'
import { RecordingView } from './components/RecordingView'
import { ProcessingStatus } from './components/ProcessingStatus'
import { ResultView } from './components/ResultView'
import { getResult, getStatus } from './services/api'
import type { Result } from './types'

type AppState = 'idle' | 'processing' | 'result' | 'error'

const SESSION_KEY = 'physiodoc_session_id'

function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  // On mount: check if there's an active session from before refresh
  useEffect(() => {
    const savedSessionId = localStorage.getItem(SESSION_KEY)
    if (!savedSessionId) return

    getStatus(savedSessionId)
      .then((status) => {
        if (status.status === 'processing') {
          setSessionId(savedSessionId)
          setAppState('processing')
        } else if (status.status === 'done' && status.result_id) {
          localStorage.removeItem(SESSION_KEY)
          return getResult(status.result_id).then((r) => {
            setResult(r)
            setAppState('result')
          })
        } else if (status.status === 'error') {
          localStorage.removeItem(SESSION_KEY)
          setError(status.error ?? 'Verarbeitung fehlgeschlagen')
          setAppState('error')
        }
      })
      .catch(() => {
        // Session no longer exists on server
        localStorage.removeItem(SESSION_KEY)
      })
  }, [])

  const handleProcessingStarted = useCallback((sid: string) => {
    localStorage.setItem(SESSION_KEY, sid)
    setSessionId(sid)
    setAppState('processing')
    setError(null)
  }, [])

  const handleDone = useCallback(async (resultId: string) => {
    localStorage.removeItem(SESSION_KEY)
    try {
      const r = await getResult(resultId)
      setResult(r)
      setAppState('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load result')
      setAppState('error')
    }
  }, [])

  const handleError = useCallback((msg: string) => {
    localStorage.removeItem(SESSION_KEY)
    setError(msg)
    setAppState('error')
  }, [])

  const handleNewRecording = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setAppState('idle')
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

      <main className="max-w-4xl mx-auto px-4 py-8">
        {appState === 'idle' && (
          <RecordingView
            onProcessingStarted={handleProcessingStarted}
            onError={handleError}
          />
        )}

        {appState === 'processing' && sessionId && (
          <ProcessingStatus
            sessionId={sessionId}
            onDone={handleDone}
            onError={handleError}
          />
        )}

        {appState === 'result' && result && (
          <ResultView result={result} onNewRecording={handleNewRecording} />
        )}

        {appState === 'error' && (
          <div className="text-center space-y-4">
            <div className="bg-red-50 text-red-700 rounded-lg p-4">{error || 'Ein unbekannter Fehler ist aufgetreten.'}</div>
            <button
              onClick={handleNewRecording}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              Erneut versuchen
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
