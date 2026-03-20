import { useEffect, useState } from 'react'
import { getStatus } from '../services/api'
import type { ProcessingStep } from '../types'

interface ProcessingStatusProps {
  sessionId: string
  onDone: (resultId: string) => void
  onError: (error: string) => void
}

const STEP_LABELS: Record<string, string> = {
  transcription: 'Transkription',
  correction: 'Korrektur',
  summarization: 'Zusammenfassung',
}

const STEP_ORDER = ['transcription', 'correction', 'summarization'] as const

export function ProcessingStatus({ sessionId, onDone, onError }: ProcessingStatusProps) {
  const [steps, setSteps] = useState<ProcessingStep>({
    transcription: 'pending',
    correction: 'pending',
    summarization: 'pending',
  })

  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const status = await getStatus(sessionId)
        if (!active) return
        if (status.steps) setSteps(status.steps)
        if (status.status === 'done' && status.result_id) {
          onDone(status.result_id)
          return
        }
        setTimeout(poll, 2000)
      } catch (err) {
        if (active) onError(err instanceof Error ? err.message : 'Status check failed')
      }
    }
    poll()
    return () => { active = false }
  }, [sessionId, onDone, onError])

  return (
    <div className="flex items-center justify-center gap-4 py-8">
      {STEP_ORDER.map((step, i) => (
        <div key={step} className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
              steps[step] === 'done'
                ? 'bg-green-100 text-green-700'
                : steps[step] === 'processing'
                  ? 'bg-blue-100 text-blue-700 animate-pulse'
                  : 'bg-gray-100 text-gray-400'
            }`}>
              {steps[step] === 'done' ? '✓' : i + 1}
            </div>
            <span className={`text-xs ${
              steps[step] === 'done'
                ? 'text-green-700'
                : steps[step] === 'processing'
                  ? 'text-blue-700 font-medium'
                  : 'text-gray-400'
            }`}>
              {STEP_LABELS[step]}
            </span>
          </div>
          {i < STEP_ORDER.length - 1 && (
            <div className={`w-12 h-0.5 mb-6 ${
              steps[step] === 'done' ? 'bg-green-300' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}
