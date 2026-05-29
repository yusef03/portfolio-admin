'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/components/Toast'
import type { ChangelogEntry } from '@/lib/types'

// ─── Activity Log ─────────────────────────────────────────────────────────────

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
      body: JSON.stringify({ ...payload, category: 'changelog' }),
    })
  } catch { /* silent */ }
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ActiveLang = 'de' | 'en' | 'ar'
type Category = 'feature' | 'fix' | 'refactor' | 'security'
type EditableEntry = Omit<ChangelogEntry, 'id' | 'created_at'>

const EMPTY_ENTRY: EditableEntry = {
  version: '',
  date: new Date().toISOString().slice(0, 10),
  category: 'feature',
  title_de: '', title_en: '', title_ar: '',
  description_de: '', description_en: '', description_ar: '',
  published: false,
}

// Farben gespiegelt aus css/pages/roadmap.css (.changelog-category.*)
const CATEGORY_META: Record<Category, { label: string; cls: string }> = {
  feature:  { label: 'Feature',  cls: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30' },
  fix:      { label: 'Fix',      cls: 'text-green-300 bg-green-500/10 border-green-500/30' },
  refactor: { label: 'Refactor', cls: 'text-blue-300 bg-blue-500/10 border-blue-500/30' },
  security: { label: 'Security', cls: 'text-red-300 bg-red-500/10 border-red-500/30' },
}

// ─── Editor Modal ─────────────────────────────────────────────────────────────

function ChangelogEditor({
  initial,
  isNew,
  existingVersions,
  onSave,
  onCancel,
}: {
  initial: Partial<ChangelogEntry>
  isNew: boolean
  existingVersions: string[]
  onSave: (data: EditableEntry) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<EditableEntry>({ ...EMPTY_ENTRY, ...initial })
  const [lang, setLang] = useState<ActiveLang>('de')

  function set<K extends keyof EditableEntry>(key: K, val: EditableEntry[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  const titleKey = `title_${lang}` as 'title_de' | 'title_en' | 'title_ar'
  const descKey = `description_${lang}` as 'description_de' | 'description_en' | 'description_ar'

  const versionTrimmed = form.version.trim()
  const versionTaken = existingVersions.includes(versionTrimmed)
  const canSave = versionTrimmed.length > 0 && !versionTaken

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-950 border border-gray-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <h3 className="text-white font-bold text-lg mb-5">
          {isNew ? 'Neuer Release' : 'Release bearbeiten'}
        </h3>

        {/* Version + Datum */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Version *</label>
            <input
              type="text"
              value={form.version}
              onChange={e => set('version', e.target.value)}
              placeholder="v1.4.0"
              className={`w-full bg-gray-900 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none ${
                versionTaken ? 'border-red-600 focus:border-red-500' : 'border-gray-700 focus:border-violet-500'
              }`}
            />
            {versionTaken && (
              <p className="text-red-400 text-xs mt-1">Version existiert bereits</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Datum</label>
            <input
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Kategorie */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Kategorie</label>
          <div className="flex gap-2">
            {(['feature', 'fix', 'refactor', 'security'] as const).map(c => (
              <button
                key={c}
                onClick={() => set('category', c)}
                className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${
                  form.category === c
                    ? 'border-violet-500 bg-violet-900/30 text-violet-300'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </div>

        {/* Lang Tabs */}
        <div className="flex gap-1 mb-4">
          {(['de', 'en', 'ar'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                lang === l ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Titel */}
        <div className="mb-3">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Titel</label>
          <input
            type="text"
            value={form[titleKey]}
            onChange={e => set(titleKey, e.target.value)}
            placeholder={`Titel auf ${lang.toUpperCase()}…`}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Beschreibung */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">
            Beschreibung <span className="text-gray-600 normal-case">(was wurde geliefert)</span>
          </label>
          <textarea
            value={form[descKey]}
            onChange={e => set(descKey, e.target.value)}
            placeholder={`Beschreibung auf ${lang.toUpperCase()}…`}
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 resize-none"
          />
        </div>

        {/* Published Toggle */}
        <button
          onClick={() => set('published', !form.published)}
          className={`w-full mb-5 flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
            form.published
              ? 'border-green-700 bg-green-900/20 text-green-300'
              : 'border-gray-700 bg-gray-900 text-gray-400'
          }`}
        >
          <span>{form.published ? '✓ Veröffentlicht (erscheint nach Publish auf der Seite)' : 'Entwurf (noch nicht öffentlich)'}</span>
          <span className={`w-9 h-5 rounded-full relative transition-colors ${form.published ? 'bg-green-600' : 'bg-gray-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.published ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
        </button>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => canSave && onSave(form)}
            disabled={!canSave}
            className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Speichern
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChangelogPage() {
  const toast = useToast()
  const showToast = (msg: string, type: 'success' | 'error' | 'info' | 'warning') => toast[type](msg)

  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'running' | 'success' | 'failure'>('idle')
  const [editEntry, setEditEntry] = useState<Partial<ChangelogEntry> | null>(null)
  const [isNewEntry, setIsNewEntry] = useState(false)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('changelog')
      .select('*')
      .order('date', { ascending: false })
      .order('version', { ascending: false })
    if (error) {
      showToast('Fehler beim Laden der Einträge', 'error')
    } else {
      setEntries(data ?? [])
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])

  // ── Save ──────────────────────────────────────────────────────────────────

  async function saveEntry(form: EditableEntry) {
    const version = form.version.trim()
    // Version-Duplikat-Check (zusätzlich zur DB-Constraint)
    const clash = entries.find(e => e.version === version && e.id !== editEntry?.id)
    if (clash) {
      showToast(`Version ${version} existiert bereits`, 'error')
      return
    }

    const payload = { ...form, version }
    let error
    if (isNewEntry) {
      const res = await supabase.from('changelog').insert(payload)
      error = res.error
    } else if (editEntry?.id) {
      const res = await supabase.from('changelog').update(payload).eq('id', editEntry.id)
      error = res.error
    }

    if (error) {
      showToast(`Fehler beim Speichern: ${error.message}`, 'error')
      await log({ action: isNewEntry ? 'create' : 'update', status: 'error', error: error.message })
    } else {
      showToast(isNewEntry ? 'Release erstellt' : 'Release gespeichert', 'success')
      await log({ action: isNewEntry ? 'create' : 'update', status: 'success', message: `${version} — ${form.title_de}` })
      setEditEntry(null)
      setIsNewEntry(false)
      loadEntries()
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function deleteEntry(id: string) {
    const entry = entries.find(e => e.id === id)
    if (!confirm(`Release "${entry?.version} — ${entry?.title_de}" wirklich löschen?`)) return
    const { error } = await supabase.from('changelog').delete().eq('id', id)
    if (error) {
      showToast(`Fehler: ${error.message}`, 'error')
    } else {
      showToast('Release gelöscht', 'success')
      await log({ action: 'delete', status: 'success', message: entry?.version })
      loadEntries()
    }
  }

  // ── Published Toggle (inline) ─────────────────────────────────────────────

  async function togglePublished(entry: ChangelogEntry) {
    const next = !entry.published
    // optimistic update
    setEntries(es => es.map(e => e.id === entry.id ? { ...e, published: next } : e))
    const { error } = await supabase.from('changelog').update({ published: next }).eq('id', entry.id)
    if (error) {
      showToast(`Fehler: ${error.message}`, 'error')
      loadEntries() // revert
    } else {
      await log({ action: 'publish-toggle', status: 'success', message: `${entry.version} → ${next ? 'veröffentlicht' : 'Entwurf'}` })
    }
  }

  // ── Publish ──────────────────────────────────────────────────────────────────

  async function handlePublish() {
    setPublishing(true)
    setPublishStatus('running')
    try {
      const res = await fetch('/api/publish?target=roadmap', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        showToast('GitHub Action gestartet — live in ~2 Min', 'success')
        setPublishStatus('success')
        await log({ action: 'publish', status: 'success', message: 'publish-roadmap.yml ausgelöst (changelog)' })
      } else {
        showToast(`Publish fehlgeschlagen: ${data.message}`, 'error')
        setPublishStatus('failure')
        await log({ action: 'publish', status: 'error', error: data.message })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
      showToast(`Fehler: ${msg}`, 'error')
      setPublishStatus('failure')
    }
    setPublishing(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const existingVersions = entries
    .filter(e => e.id !== editEntry?.id)
    .map(e => e.version)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Changelog</h2>
          <p className="text-gray-400 text-sm mt-1">Releases dokumentieren — dreisprachig, mit Versionierung</p>
        </div>
        <button
          onClick={handlePublish}
          disabled={publishing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            publishing
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : publishStatus === 'success'
              ? 'bg-green-900/40 text-green-400 border border-green-700'
              : publishStatus === 'failure'
              ? 'bg-red-900/40 text-red-400 border border-red-700'
              : 'bg-violet-600 hover:bg-violet-700 text-white'
          }`}
        >
          {publishing ? '⟳ Publiziere…' : publishStatus === 'success' ? '✓ Gestartet' : '⤴ Publish'}
        </button>
      </div>

      {/* Info */}
      <div className="mb-5 p-3 bg-blue-900/20 border border-blue-800 rounded-lg text-xs text-blue-300">
        <strong>Hinweis:</strong> Nur <strong>veröffentlichte</strong> Releases erscheinen nach „Publish" auf der <code>/roadmap</code>-Seite.
        Entwürfe (z.B. via „→ CL" aus der Roadmap) bleiben verborgen, bis du sie veröffentlichst.
      </div>

      {/* + Release */}
      <div className="flex justify-end mb-5">
        <button
          onClick={() => { setEditEntry({ ...EMPTY_ENTRY }); setIsNewEntry(true) }}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          + Release
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-gray-500 text-sm text-center py-12">Lädt…</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-gray-600 border border-dashed border-gray-800 rounded-xl">
          <p className="text-lg mb-2">Noch keine Releases</p>
          <p className="text-sm">Klicke „+ Release" um den ersten anzulegen.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => {
            const cat = CATEGORY_META[entry.category]
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-3 bg-gray-900 border rounded-lg group hover:border-gray-700 transition-colors ${
                  entry.published ? 'border-gray-800' : 'border-gray-800 opacity-70'
                }`}
              >
                {/* Version */}
                <span className="text-white text-sm font-mono font-semibold flex-shrink-0 w-16">{entry.version}</span>

                {/* Titel + Datum */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {entry.title_de || <span className="text-gray-600 italic">Kein Titel</span>}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">{entry.date}</p>
                </div>

                {/* Kategorie-Badge */}
                <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${cat.cls}`}>
                  {cat.label}
                </span>

                {/* Published-Toggle */}
                <button
                  onClick={() => togglePublished(entry)}
                  title={entry.published ? 'Veröffentlicht — klicken für Entwurf' : 'Entwurf — klicken zum Veröffentlichen'}
                  className={`text-xs px-2 py-1 rounded border flex-shrink-0 transition-colors ${
                    entry.published
                      ? 'bg-green-900/30 text-green-400 border-green-800 hover:bg-green-900/60'
                      : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'
                  }`}
                >
                  {entry.published ? '● Live' : '○ Entwurf'}
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => { setEditEntry(entry); setIsNewEntry(false) }}
                    className="text-gray-500 hover:text-white p-1.5 rounded hover:bg-gray-800 transition-colors text-sm"
                    title="Bearbeiten"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="text-gray-600 hover:text-red-400 p-1.5 rounded hover:bg-gray-800 transition-colors text-sm"
                    title="Löschen"
                  >
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Editor Modal */}
      {editEntry && (
        <ChangelogEditor
          initial={editEntry}
          isNew={isNewEntry}
          existingVersions={existingVersions}
          onSave={saveEntry}
          onCancel={() => { setEditEntry(null); setIsNewEntry(false) }}
        />
      )}
    </div>
  )
}
