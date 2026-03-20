import { useState, useEffect, useCallback } from 'react'
import { listResults, searchResults, deleteResult, getResult } from '../services/api'
import { ResultView } from './ResultView'
import type { ResultSummary, Result } from '../types'

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')} min`
}

export function ArchiveView() {
  const [results, setResults] = useState<ResultSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedResult, setSelectedResult] = useState<Result | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const loadResults = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listResults()
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadResults()
  }, [loadResults])

  useEffect(() => {
    if (!searchQuery.trim()) {
      loadResults()
      return
    }

    const timeout = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const data = await searchResults(searchQuery.trim())
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [searchQuery, loadResults])

  const handleOpenDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setDetailError(null)
    setSelectedResult(null)
    try {
      const full = await getResult(id)
      setSelectedResult(full)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Fehler beim Laden')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleBack = useCallback(() => {
    setSelectedResult(null)
    setDetailError(null)
  }, [])

  const handleDeleteConfirm = useCallback(async (id: string) => {
    try {
      await deleteResult(id)
      setResults((prev) => prev.filter((r) => r.id !== id))
      setConfirmDeleteId(null)
      setDeleteError(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
    }
  }, [])

  // Detail view
  if (detailLoading) {
    return (
      <div className="text-center text-gray-500 py-12">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-3" />
        <p>Eintrag wird geladen...</p>
      </div>
    )
  }

  if (detailError) {
    return (
      <div className="text-center space-y-4 py-12">
        <div className="bg-red-50 text-red-700 rounded-lg p-4">{detailError}</div>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
        >
          Zurück
        </button>
      </div>
    )
  }

  if (selectedResult) {
    return (
      <div>
        <button
          onClick={handleBack}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Zurück zum Verlauf
        </button>
        <ResultView result={selectedResult} onNewRecording={handleBack} />
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Verlauf durchsuchen..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searchLoading && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {deleteError && (
        <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{deleteError}</div>
      )}

      {/* Results list */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-3" />
          <p>Wird geladen...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          {searchQuery.trim()
            ? 'Keine Einträge für diese Suche gefunden.'
            : 'Noch keine Aufnahmen gespeichert.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {results.map((r) => (
            <li key={r.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <button
                  onClick={() => handleOpenDetail(r.id)}
                  className="flex-1 text-left space-y-1 min-w-0"
                >
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="font-medium text-gray-700">{formatDate(r.timestamp)}</span>
                    <span>{formatDuration(r.duration_seconds)}</span>
                    <span className="truncate text-gray-400">{r.filename}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{r.summary}</p>
                </button>

                <div className="flex-shrink-0 flex items-center gap-2">
                  {confirmDeleteId === r.id ? (
                    <>
                      <span className="text-xs text-gray-500">Löschen?</span>
                      <button
                        onClick={() => handleDeleteConfirm(r.id)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Ja
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                      >
                        Abbrechen
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(r.id)}
                      className="px-2 py-1 text-xs text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
                      title="Löschen"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
