import { useState, useEffect } from 'react'
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
  const [editedCorrected, setEditedCorrected] = useState(result.corrected_transcript)
  const [isEditing, setIsEditing] = useState(false)
  const [editingTab, setEditingTab] = useState<Tab | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copiedTab, setCopiedTab] = useState<Tab | null>(null)

  useEffect(() => {
    setEditedSummary(result.summary)
    setEditedCorrected(result.corrected_transcript)
    setIsEditing(false)
    setEditingTab(null)
  }, [result.id])

  const handleCopy = async (tab: Tab, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedTab(tab)
    setTimeout(() => setCopiedTab(null), 2000)
  }

  const handleEdit = (tab: Tab) => {
    setIsEditing(true)
    setEditingTab(tab)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditingTab(null)
    if (editingTab === 'summary') setEditedSummary(result.summary)
    if (editingTab === 'corrected') setEditedCorrected(result.corrected_transcript)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const update: Record<string, string> = {}
      if (editingTab === 'summary') update.summary = editedSummary
      if (editingTab === 'corrected') update.corrected_transcript = editedCorrected
      await updateResult(result.id, update)
      setIsEditing(false)
      setEditingTab(null)
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
    corrected: editedCorrected,
    raw: result.raw_transcript,
  }

  const isEditableTab = activeTab === 'summary' || activeTab === 'corrected'
  const isCurrentlyEditing = isEditing && editingTab === activeTab

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
      <div className="relative bg-white rounded-lg border p-4 min-h-[300px]">
        <button
          onClick={() => handleCopy(activeTab, content[activeTab])}
          className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="In Zwischenablage kopieren"
        >
          {copiedTab === activeTab ? (
            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
        {isCurrentlyEditing ? (
          <textarea
            value={content[activeTab]}
            onChange={(e) => {
              if (activeTab === 'summary') setEditedSummary(e.target.value)
              if (activeTab === 'corrected') setEditedCorrected(e.target.value)
            }}
            className="w-full h-96 text-sm font-mono resize-y border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-sans">{content[activeTab]}</pre>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {isEditableTab && (
          <>
            {isCurrentlyEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                >
                  Abbrechen
                </button>
              </>
            ) : (
              <button
                onClick={() => handleEdit(activeTab)}
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
