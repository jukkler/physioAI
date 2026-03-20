import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage } from '../types'
import { sendChatMessage } from '../services/api'

const SUGGESTED_PROMPTS = [
  'Übungsanleitung für Patienten erstellen',
  'Differentialdiagnosen zu...',
  'E-Mail an Überweiser formulieren',
  'Behandlungsbericht erstellen',
]

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    setInput('')
    setError(null)

    const userMessage: ChatMessage = { role: 'user', content: trimmed }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsStreaming(true)
    setStreamingContent('')

    const history = updatedMessages.map((m) => ({ role: m.role, content: m.content }))

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      await sendChatMessage(
        trimmed,
        history.slice(0, -1),
        (token) => {
          setStreamingContent((prev) => prev + token)
        },
        (fullResponse) => {
          setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }])
          setStreamingContent('')
          setIsStreaming(false)
          abortControllerRef.current = null
        },
        abortController.signal,
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // User cancelled — commit whatever was streamed so far
        if (streamingContent) {
          setMessages((prev) => [...prev, { role: 'assistant', content: streamingContent }])
        }
        setStreamingContent('')
        setIsStreaming(false)
        return
      }
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setMessages((prev) => [...prev, { role: 'assistant', content: `Fehler: ${msg}` }])
      setStreamingContent('')
      setIsStreaming(false)
      setError(msg)
    }
  }, [messages, isStreaming, streamingContent])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  const handleAbort = () => {
    abortControllerRef.current?.abort()
  }

  const handleClear = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort()
    }
    setMessages([])
    setStreamingContent('')
    setIsStreaming(false)
    setError(null)
    setInput('')
  }

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
    textareaRef.current?.focus()
  }

  const isEmpty = messages.length === 0 && !isStreaming

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">KI-Assistent</h2>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="text-sm text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
            title="Chat leeren"
          >
            Chat leeren
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
            <div>
              <p className="text-gray-500 text-sm mb-4">Wie kann ich Ihnen helfen?</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors shadow-sm"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Streaming message */}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap bg-white border border-gray-200 text-gray-800 shadow-sm">
              {streamingContent || ''}
              <span className="inline-block w-[2px] h-[1em] bg-gray-500 ml-[1px] align-middle animate-pulse" />
            </div>
          </div>
        )}

        {error && !isStreaming && (
          <div className="text-xs text-red-500 text-center">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="mt-3 flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nachricht eingeben... (Enter zum Senden, Shift+Enter für Zeilenumbruch)"
          rows={3}
          disabled={isStreaming}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
        />
        {isStreaming ? (
          <button
            onClick={handleAbort}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors shrink-0 h-10"
          >
            Stopp
          </button>
        ) : (
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 h-10"
          >
            Senden
          </button>
        )}
      </div>
    </div>
  )
}
