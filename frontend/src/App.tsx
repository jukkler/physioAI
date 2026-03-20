import { useState, useCallback, useEffect } from 'react'
import { RecordingView } from './components/RecordingView'
import { ProcessingStatus } from './components/ProcessingStatus'
import { ResultView } from './components/ResultView'
import { TabNav } from './components/TabNav'
import { ArchiveView } from './components/ArchiveView'
import { ChatView } from './components/ChatView'
import { getResult, getStatus } from './services/api'
import type { Result } from './types'
import type { Tab } from './components/TabNav'

type RecordingState = 'idle' | 'processing' | 'result' | 'error'

const SESSION_KEY = 'physiodoc_session_id'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('recording')
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
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
        // Session no longer exists on server
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

      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

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
                <div className="bg-red-50 text-red-700 rounded-lg p-4">{error || 'Ein unbekannter Fehler ist aufgetreten.'}</div>
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

        {activeTab === 'chat' && <ChatView />}

        {activeTab === 'archive' && <ArchiveView />}
      </main>
    </div>
  )
}

export default App
