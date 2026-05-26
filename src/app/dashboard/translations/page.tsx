'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// ─── Types ────────────────────────────────────────────────────────────────────

type Translation = {
  id: string
  key: string
  de: string
  en: string
  ar: string
  updated_at: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type PublishStatus = 'idle' | 'publishing' | 'success' | 'error'
type FilterLang = 'all' | 'missing_en' | 'missing_ar' | 'missing_any'

// ─── Supabase Client ──────────────────────────────────────────────────────────

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function isMissing(val: string) {
  return !val || val.trim() === ''
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function TranslationsPage() {
  const [rows, setRows] = useState<Translation[]>([])
  const [filtered, setFiltered] = useState<Translation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLang, setFilterLang] = useState<FilterLang>('all')
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [translating, setTranslating] = useState<Record<string, boolean>>({})
  const [bulkTranslating, setBulkTranslating] = useState(false)
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle')
  const [publishMsg, setPublishMsg] = useState('')
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ─── Daten laden ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('translations')
      .select('*')
      .order('key', { ascending: true })

    if (error) {
      console.error('Fehler beim Laden:', error)
    } else {
      setRows(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ─── Filtern ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let result = rows

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.key.toLowerCase().includes(q) ||
        r.de.toLowerCase().includes(q) ||
        r.en.toLowerCase().includes(q)
      )
    }

    if (filterLang === 'missing_en') result = result.filter(r => isMissing(r.en))
    if (filterLang === 'missing_ar') result = result.filter(r => isMissing(r.ar))
    if (filterLang === 'missing_any') result = result.filter(r => isMissing(r.en) || isMissing(r.ar))

    setFiltered(result)
  }, [rows, search, filterLang])

  // ─── Auto-Save (on blur, debounced) ─────────────────────────────────────────

  const handleChange = (id: string, field: 'de' | 'en' | 'ar', value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))

    // Debounce: 800ms nach letzter Änderung speichern
    clearTimeout(saveTimers.current[id])
    setSaveStatus(prev => ({ ...prev, [id]: 'saving' }))
    saveTimers.current[id] = setTimeout(() => save(id, field, value), 800)
  }

  const save = async (id: string, field: string, value: string) => {
    const { error } = await supabase
      .from('translations')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', id)

    setSaveStatus(prev => ({ ...prev, [id]: error ? 'error' : 'saved' }))
    setTimeout(() => setSaveStatus(prev => ({ ...prev, [id]: 'idle' })), 2000)
  }

  // ─── Übersetzen (einzeln) ────────────────────────────────────────────────────

  const translateRow = async (row: Translation) => {
    if (!row.de.trim()) return
    setTranslating(prev => ({ ...prev, [row.id]: true }))

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: row.de, both: true }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Übersetzungsfehler')

      // In DB speichern
      await supabase
        .from('translations')
        .update({ en: data.en, ar: data.ar, updated_at: new Date().toISOString() })
        .eq('id', row.id)

      // Lokal updaten
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, en: data.en, ar: data.ar } : r))
      setSaveStatus(prev => ({ ...prev, [row.id]: 'saved' }))
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [row.id]: 'idle' })), 2000)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Fehler'
      alert(`Übersetzungsfehler: ${msg}`)
    } finally {
      setTranslating(prev => ({ ...prev, [row.id]: false }))
    }
  }

  // ─── Übersetzen (alle fehlenden) ─────────────────────────────────────────────

  const translateAllMissing = async () => {
    const missing = rows.filter(r => r.de.trim() && (isMissing(r.en) || isMissing(r.ar)))
    if (missing.length === 0) { alert('Keine fehlenden Übersetzungen gefunden.'); return }

    setBulkTranslating(true)
    let done = 0

    for (const row of missing) {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: row.de, both: true }),
        })
        const data = await res.json()
        if (res.ok) {
          await supabase
            .from('translations')
            .update({ en: data.en, ar: data.ar, updated_at: new Date().toISOString() })
            .eq('id', row.id)
          setRows(prev => prev.map(r => r.id === row.id ? { ...r, en: data.en, ar: data.ar } : r))
          done++
        }
      } catch { /* weiter mit nächstem */ }
    }

    setBulkTranslating(false)
    alert(`✅ ${done} von ${missing.length} Übersetzungen erzeugt.`)
  }

  // ─── Publish ─────────────────────────────────────────────────────────────────

  const publish = async () => {
    setShowPublishModal(false)
    setPublishStatus('publishing')
    setPublishMsg('GitHub Action wird gestartet…')

    try {
      const res = await fetch('/api/publish', { method: 'POST' })
      const data = await res.json()

      if (data.ok) {
        setPublishStatus('success')
        setPublishMsg(data.message)
      } else {
        setPublishStatus('error')
        setPublishMsg(data.message || data.error || 'Unbekannter Fehler')
      }
    } catch {
      setPublishStatus('error')
      setPublishMsg('Netzwerkfehler beim Publish')
    }

    setTimeout(() => { setPublishStatus('idle'); setPublishMsg('') }, 8000)
  }

  // ─── Stats ───────────────────────────────────────────────────────────────────

  const missingEn = rows.filter(r => isMissing(r.en)).length
  const missingAr = rows.filter(r => isMissing(r.ar)).length

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Translations</h2>
          <p className="text-gray-400 text-sm mt-1">
            {rows.length} Keys · {missingEn} EN fehlt · {missingAr} AR fehlt
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={translateAllMissing}
            disabled={bulkTranslating}
            className="px-3 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {bulkTranslating ? '⏳ Übersetzt…' : '🔁 Alle fehlenden übersetzen'}
          </button>
          <button
            onClick={() => setShowPublishModal(true)}
            disabled={publishStatus === 'publishing'}
            className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium disabled:opacity-50 transition-colors"
          >
            {publishStatus === 'publishing' ? '⏳ Publish läuft…' : '🚀 Publish'}
          </button>
        </div>
      </div>

      {/* Publish Status Banner */}
      {publishMsg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          publishStatus === 'success' ? 'bg-green-900/40 text-green-300 border border-green-800' :
          publishStatus === 'error' ? 'bg-red-900/40 text-red-300 border border-red-800' :
          'bg-blue-900/40 text-blue-300 border border-blue-800'
        }`}>
          {publishMsg}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Key oder Text suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
        <select
          value={filterLang}
          onChange={e => setFilterLang(e.target.value as FilterLang)}
          className="px-3 py-2 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300 focus:outline-none focus:border-purple-500"
        >
          <option value="all">Alle ({rows.length})</option>
          <option value="missing_en">EN fehlt ({missingEn})</option>
          <option value="missing_ar">AR fehlt ({missingAr})</option>
          <option value="missing_any">Irgendwas fehlt ({rows.filter(r => isMissing(r.en) || isMissing(r.ar)).length})</option>
        </select>
      </div>

      {/* Tabelle */}
      {loading ? (
        <div className="text-gray-500 text-sm py-8 text-center">Lädt…</div>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left w-48">Key</th>
                <th className="px-4 py-3 text-left">DE</th>
                <th className="px-4 py-3 text-left">EN</th>
                <th className="px-4 py-3 text-left">AR</th>
                <th className="px-4 py-3 text-center w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Keine Einträge gefunden.
                  </td>
                </tr>
              )}
              {filtered.map(row => {
                const status = saveStatus[row.id] || 'idle'
                const isTranslating = translating[row.id]
                const isExpanded = expandedKey === row.id
                const hasLongText = row.de.length > 80

                return (
                  <tr key={row.id} className="bg-gray-950 hover:bg-gray-900/50 transition-colors">
                    {/* Key */}
                    <td className="px-4 py-3 align-top">
                      <span className="font-mono text-xs text-purple-400 break-all">{row.key}</span>
                      {status === 'saving' && <span className="block text-xs text-gray-500 mt-1">💾 speichert…</span>}
                      {status === 'saved' && <span className="block text-xs text-green-500 mt-1">✓ gespeichert</span>}
                      {status === 'error' && <span className="block text-xs text-red-500 mt-1">✗ Fehler</span>}
                    </td>

                    {/* DE */}
                    <td className="px-4 py-3 align-top">
                      {hasLongText && !isExpanded ? (
                        <div
                          className="text-gray-300 text-xs cursor-pointer hover:text-white"
                          onDoubleClick={() => setExpandedKey(row.id)}
                          title="Doppelklick zum Bearbeiten"
                        >
                          <span dangerouslySetInnerHTML={{ __html: row.de.substring(0, 80) + '…' }} />
                          <span className="text-gray-500 ml-1">[Doppelklick]</span>
                        </div>
                      ) : (
                        <textarea
                          value={row.de}
                          onChange={e => handleChange(row.id, 'de', e.target.value)}
                          onBlur={() => isExpanded && setExpandedKey(null)}
                          rows={isExpanded ? 6 : 2}
                          className="w-full bg-transparent text-gray-300 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 rounded p-1"
                          dir="ltr"
                        />
                      )}
                    </td>

                    {/* EN */}
                    <td className="px-4 py-3 align-top">
                      <textarea
                        value={row.en}
                        onChange={e => handleChange(row.id, 'en', e.target.value)}
                        rows={2}
                        placeholder="—"
                        className={`w-full bg-transparent text-xs resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 rounded p-1 ${isMissing(row.en) ? 'text-yellow-600 placeholder-yellow-900' : 'text-gray-300'}`}
                        dir="ltr"
                      />
                    </td>

                    {/* AR */}
                    <td className="px-4 py-3 align-top">
                      <textarea
                        value={row.ar}
                        onChange={e => handleChange(row.id, 'ar', e.target.value)}
                        rows={2}
                        placeholder="—"
                        className={`w-full bg-transparent text-xs resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 rounded p-1 ${isMissing(row.ar) ? 'text-yellow-600 placeholder-yellow-900' : 'text-gray-300'}`}
                        dir="rtl"
                      />
                    </td>

                    {/* Aktionen */}
                    <td className="px-4 py-3 align-top text-center">
                      <button
                        onClick={() => translateRow(row)}
                        disabled={isTranslating || !row.de.trim()}
                        title="DE → EN + AR übersetzen"
                        className="text-lg hover:scale-110 transition-transform disabled:opacity-30"
                      >
                        {isTranslating ? '⏳' : '🔁'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-2">🚀 Translations publishen?</h3>
            <p className="text-gray-400 text-sm mb-6">
              GitHub Actions wird gestartet und erzeugt <code className="text-purple-400">lang/de.json</code>, <code className="text-purple-400">lang/en.json</code> und <code className="text-purple-400">lang/ar.json</code> aus Supabase. Die Änderungen sind in ~1–2 Minuten auf yusefbach.de live.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={publish}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
              >
                Ja, publishen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
