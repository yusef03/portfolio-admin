'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useToast } from '@/components/Toast'

async function log(payload: {
  action: string
  status: 'success' | 'warning' | 'error' | 'info'
  message?: string
  details?: Record<string, unknown>
  error?: string
}) {
  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, category: 'bot_memory' }),
    })
  } catch { /* silent */ }
}

export default function BotMemoryPage() {
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const hasChanges = content !== savedContent

  // Beim Schließen warnen wenn ungespeicherte Änderungen
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])

  // Initiales Laden aus Supabase
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('settings')
      .select('value, updated_at')
      .eq('key', 'bot_memory')
      .single()
      .then(({ data, error }) => {
        if (error) {
          setError('Fehler beim Laden: ' + error.message)
        } else {
          const val = data.value as { content?: string }
          const loaded = val?.content ?? ''
          setContent(loaded)
          setSavedContent(loaded)
          setSavedAt(data.updated_at)
        }
        setLoading(false)
      })
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('settings')
      .update({
        value: {
          content,
          version: 'admin-edited',
          updated_at: now,
        },
        updated_at: now,
      })
      .eq('key', 'bot_memory')

    if (error) {
      setError('Fehler beim Speichern: ' + error.message)
      toast.error('Bot Memory konnte nicht gespeichert werden', { detail: error.message })
      log({
        action: 'bot_memory_save_failed',
        status: 'error',
        message: 'Bot Memory konnte nicht gespeichert werden',
        error: error.message,
      })
    } else {
      setSavedContent(content)
      setSavedAt(now)
      toast.success('Bot Memory gespeichert — wirkt in < 5 Minuten')
      log({
        action: 'bot_memory_updated',
        status: 'success',
        message: 'Bot Memory aktualisiert',
        details: { charCount: content.length, tokenEstimate: Math.round(content.length / 4) },
      })
    }
    setSaving(false)
  }

  const charCount = content.length
  const tokenEstimate = Math.round(charCount / 4)

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-600 border-t-violet-500 rounded-full animate-spin" />
        Lädt Bot Memory...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white">Bot Memory</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            System-Prompt des AI-Twins — wirkt innerhalb von 5 Min nach Speichern
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || !hasChanges}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
            hasChanges
              ? 'bg-violet-600 hover:bg-violet-500 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          } disabled:opacity-50`}
        >
          {saving ? 'Speichert...' : hasChanges ? '● Speichern' : 'Gespeichert'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-sm flex-shrink-0">
          {error}
        </div>
      )}

      {/* Split Editor */}
      <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Linke Seite: Markdown Editor */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
            Markdown
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white text-sm font-mono resize-none focus:outline-none focus:border-violet-500 transition-colors leading-relaxed"
            spellCheck={false}
            placeholder="Bot Memory wird geladen..."
          />
        </div>

        {/* Rechte Seite: Preview */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
            Preview
          </div>
          <div className="flex-1 bg-gray-950 border border-gray-800 rounded-xl p-4 overflow-y-auto">
            <div className="prose-bot">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      {/* Statusleiste */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-600 flex-shrink-0">
        <span>{charCount.toLocaleString('de-DE')} Zeichen</span>
        <span>~{tokenEstimate.toLocaleString('de-DE')} Tokens</span>
        {savedAt && (
          <span>
            Zuletzt gespeichert:{' '}
            {new Date(savedAt).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
        {hasChanges && <span className="text-yellow-500">● Ungespeicherte Änderungen</span>}
      </div>
    </div>
  )
}
