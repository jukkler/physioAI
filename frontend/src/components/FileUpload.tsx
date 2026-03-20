import { useState, useCallback } from 'react'

const ACCEPTED_TYPES = '.mp3,.wav,.m4a,.ogg,.webm'
const ACCEPTED_MIMES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/ogg', 'audio/webm']

interface FileUploadProps {
  onFileSelected: (file: File) => void
  disabled?: boolean
}

export function FileUpload({ onFileSelected, disabled }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED_MIMES.includes(file.type)) {
      return
    }
    onFileSelected(file)
  }, [onFileSelected])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div
      className={`mt-6 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <p className="text-sm text-gray-500">
        Audio-Datei hierhin ziehen
      </p>
      <label className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
        Oder Datei auswaehlen
        <input
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </label>
      <p className="mt-1 text-xs text-gray-400">MP3, WAV, M4A, OGG, WEBM</p>
    </div>
  )
}
