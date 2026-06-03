'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
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

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-[var(--color-text-3)]">
      <span className="w-4 h-4 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)] animate-spin" />
      Lädt Bot Memory…
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-1)] tracking-tight">Bot Memory</h1>
          <p className="text-[var(--color-text-2)] text-sm mt-0.5">System-Prompt des AI-Twins — wirkt innerhalb von 5 Min nach Speichern</p>
        </div>
        <button
          onClick={save}
          disabled={saving || !hasChanges}
          className={`px-4 py-2 rounded-[var(--radius-md)] font-semibold text-sm transition-all ${
            hasChanges
              ? 'text-white [background:var(--gradient-aurora)] shadow-[var(--glow-brand)] hover:shadow-[var(--glow-brand-strong)] hover:scale-[1.02]'
              : 'bg-[var(--color-surface-2)] text-[var(--color-text-3)] cursor-not-allowed border border-[var(--color-border)]'
          } disabled:opacity-60`}
        >
          {saving ? 'Speichert…' : hasChanges ? '● Speichern' : '✓ Gespeichert'}
        </button>
      </div>

      {error && (
        <div className="rounded-[var(--radius-md)] border p-3 mb-4 text-sm text-[var(--color-danger)] flex-shrink-0"
          style={{ borderColor: 'rgba(239,68,68,.3)', background: 'rgba(239,68,68,.06)' }}>
          {error}
        </div>
      )}

      {/* Split Editor */}
      <div className="flex gap-4 min-h-0 flex-1 flex-col sm:flex-row" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Markdown Editor */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="text-xs text-[var(--color-text-3)] uppercase tracking-wider mb-2 font-medium">Markdown</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 w-full bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4 text-[var(--color-text-1)] text-sm font-mono resize-none focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors leading-relaxed"
            spellCheck={false}
            placeholder="Bot Memory wird geladen…"
          />
        </div>

        {/* Preview */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="text-xs text-[var(--color-text-3)] uppercase tracking-wider mb-2 font-medium">Preview</div>
          <div className="flex-1 bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4 overflow-y-auto">
            <div className="prose-bot">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      {/* Statusleiste */}
      <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-3)] flex-shrink-0 flex-wrap">
        <span>{charCount.toLocaleString('de-DE')} Zeichen</span>
        <span>~{tokenEstimate.toLocaleString('de-DE')} Tokens</span>
        {savedAt && (
          <span>Zuletzt gespeichert: {new Date(savedAt).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
        )}
        {hasChanges && <span className="text-[var(--color-warning)] font-medium">● Ungespeicherte Änderungen</span>}
      </div>
    </div>
  )
}
