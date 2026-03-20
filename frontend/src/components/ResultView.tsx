import { useState } from 'react'
import { updateResult } from '../services/api'
import type { Result } from '../types'

type Tab = 'summary' | 'corrected' | 'raw'

interface ResultViewProps {
  result: Result
  onNewRecording: () => void
}

export function ResultView({ result, onNewRecording }: ResultViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [editedSummary, setEditedSummary] = useState(result.summary)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateResult(result.id, { summary: editedSummary })
      setIsEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // Could show error, but keep simple for now
    } finally {
      setSaving(false)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'summary', label: 'Zusammenfassung' },
    { key: 'corrected', label: 'Korrigiertes Transkript' },
    { key: 'raw', label: 'Roh-Transkript' },
  ]

  const content: Record<Tab, string> = {
    summary: editedSummary,
    corrected: result.corrected_transcript,
    raw: result.raw_transcript,
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border p-4 min-h-[300px]">
        {activeTab === 'summary' && isEditing ? (
          <textarea
            value={editedSummary}
            onChange={(e) => setEditedSummary(e.target.value)}
            className="w-full h-96 text-sm font-mono resize-y border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-sans">{content[activeTab]}</pre>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {activeTab === 'summary' && (
          <>
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditedSummary(result.summary) }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                >
                  Abbrechen
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Bearbeiten
              </button>
            )}
          </>
        )}

        <button
          onClick={onNewRecording}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 ml-auto"
        >
          Neue Aufnahme
        </button>

        {saved && <span className="text-green-600 text-sm self-center">Gespeichert!</span>}
      </div>
    </div>
  )
}
