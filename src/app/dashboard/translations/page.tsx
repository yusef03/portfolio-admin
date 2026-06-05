'use client'

/**
 * Translations Admin
 *
 * Architektur (repo-first):
 *   - Liest lang/de.json + lang/en.json + lang/ar.json direkt aus GitHub
 *     via GET /api/lang-files
 *   - Änderungen werden lokal im React-State gehalten
 *   - "Commit to GitHub" POSTet alle Zeilen an POST /api/lang-files,
 *     das die 3 Dateien in einem Zug committed (3 separate Git-Commits)
 *   - Keine Supabase-Translations-Tabelle mehr nötig
 *   - DeepL-Auto-Übersetzung bleibt, aktualisiert nur den lokalen State
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useToast } from '@/components/Toast'
import {
  PageHeader, Button, Input, Select, Modal, Badge, PageTransition,
} from '@/components/ui'
import {
  Globe, Languages, Zap, GitCommit, RotateCcw,
  CheckCircle2, XCircle, Loader2, AlertCircle,
} from 'lucide-react'

// ─── Logging ───────────────────────────────────────────────────────────────────
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
      body: JSON.stringify({ ...payload, category: 'translations' }),
    })
  } catch { /**/ }
}

// ─── Types ─────────────────────────────────────────────────────────────────────
type LangRow = { key: string; de: string; en: string; ar: string }
type FilterLang = 'all' | 'missing_en' | 'missing_ar' | 'missing_any'
type CommitStatus = 'idle' | 'committing' | 'success' | 'error'

// ─── Helpers ───────────────────────────────────────────────────────────────────
function isMissing(v: string) { return !v || v.trim() === '' }

// ─── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, accent = false, warn = false,
}: {
  icon: React.ElementType; label: string; value: number | string
  accent?: boolean; warn?: boolean
}) {
  return (
    <div
      className="rounded-[var(--radius-lg)] border p-4 flex items-center gap-4"
      style={{
        background: accent
          ? 'var(--gradient-aurora-soft)'
          : warn && Number(value) > 0
          ? 'rgba(255,214,10,.06)'
          : 'var(--color-surface-1)',
        borderColor: accent
          ? 'rgba(10,132,255,.25)'
          : warn && Number(value) > 0
          ? 'rgba(255,214,10,.3)'
          : 'var(--color-border)',
      }}
    >
      <div
        className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
        style={{
          background: accent
            ? 'var(--gradient-aurora)'
            : warn && Number(value) > 0
            ? 'rgba(255,214,10,.12)'
            : 'var(--color-surface-2)',
        }}
      >
        <Icon
          size={16}
          strokeWidth={1.75}
          style={{
            color: accent
              ? '#fff'
              : warn && Number(value) > 0
              ? 'var(--color-warning)'
              : 'var(--color-text-3)',
          }}
        />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-[var(--color-text-1)] leading-none">{value}</p>
        <p className="text-xs text-[var(--color-text-3)] mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TranslationsPage() {
  const [rows, setRows]           = useState<LangRow[]>([])
  const [filtered, setFiltered]   = useState<LangRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState('')

  const [search, setSearch]         = useState('')
  const [filterLang, setFilterLang] = useState<FilterLang>('all')

  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set())
  const [translating, setTranslating] = useState<Record<string, boolean>>({})
  const [bulkTranslating, setBulkTranslating] = useState(false)

  const [commitStatus, setCommitStatus] = useState<CommitStatus>('idle')
  const [commitMsg, setCommitMsg]       = useState('')
  const [showCommitModal, setShowCommitModal] = useState(false)

  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // Für die Row-Suche beim Editieren
  const rowsRef = useRef<LangRow[]>([])
  rowsRef.current = rows

  const toast = useToast()

  // ─── Daten laden (aus GitHub) ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/lang-files', { cache: 'no-store' })
      const data = await res.json() as { rows?: LangRow[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      setRows(data.rows ?? [])
      setChangedKeys(new Set())
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setLoadError(msg)
      toast.error('Fehler beim Laden', { detail: msg })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  // ─── Filter ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let result = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.key.toLowerCase().includes(q) ||
        r.de.toLowerCase().includes(q) ||
        r.en.toLowerCase().includes(q) ||
        r.ar.includes(q)
      )
    }
    if (filterLang === 'missing_en')  result = result.filter(r => isMissing(r.en))
    if (filterLang === 'missing_ar')  result = result.filter(r => isMissing(r.ar))
    if (filterLang === 'missing_any') result = result.filter(r => isMissing(r.en) || isMissing(r.ar))
    setFiltered(result)
  }, [rows, search, filterLang])

  // ─── Feld editieren (nur lokaler State) ────────────────────────────────────
  const handleChange = (key: string, field: 'de' | 'en' | 'ar', value: string) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r))
    setChangedKeys(prev => new Set(prev).add(key))
  }

  // ─── DeepL: einzelne Zeile übersetzen ─────────────────────────────────────
  const translateRow = async (row: LangRow) => {
    if (!row.de.trim()) return
    setTranslating(prev => ({ ...prev, [row.key]: true }))
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: row.de, both: true }),
      })
      const data = await res.json() as { en?: string; ar?: string; error?: string }
      if (!res.ok) throw new Error(data.error || 'Übersetzungsfehler')

      setRows(prev => prev.map(r =>
        r.key === row.key ? { ...r, en: data.en ?? r.en, ar: data.ar ?? r.ar } : r
      ))
      setChangedKeys(prev => new Set(prev).add(row.key))
      toast.success(`Übersetzt: ${row.key}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Fehler'
      toast.error('Übersetzungsfehler', { detail: msg })
    } finally {
      setTranslating(prev => ({ ...prev, [row.key]: false }))
    }
  }

  // ─── DeepL: alle fehlenden übersetzen ─────────────────────────────────────
  const translateAllMissing = async () => {
    const missing = rows.filter(r => r.de.trim() && (isMissing(r.en) || isMissing(r.ar)))
    if (missing.length === 0) { toast.info('Keine fehlenden Übersetzungen.'); return }
    setBulkTranslating(true)
    toast.info(`Starte Bulk-Übersetzung für ${missing.length} Keys…`)
    let done = 0, failed = 0

    for (const row of missing) {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: row.de, both: true }),
        })
        const data = await res.json() as { en?: string; ar?: string; error?: string }
        if (res.ok && data.en) {
          setRows(prev => prev.map(r =>
            r.key === row.key ? { ...r, en: data.en ?? r.en, ar: data.ar ?? r.ar } : r
          ))
          setChangedKeys(prev => new Set(prev).add(row.key))
          done++
        } else {
          failed++
        }
      } catch { failed++ }
    }

    setBulkTranslating(false)
    if (failed === 0) toast.success(`${done} Übersetzungen erzeugt — jetzt Commit klicken`)
    else toast.warning(`${done} erzeugt, ${failed} fehlgeschlagen`)
    log({
      action: 'translations_bulk',
      status: failed === 0 ? 'success' : 'warning',
      message: `Bulk: ${done} erfolgreich, ${failed} fehlgeschlagen`,
      details: { total: missing.length, done, failed },
    })
  }

  // ─── Commit: alle Zeilen ins GitHub-Repo schreiben ────────────────────────
  const commitToGitHub = async () => {
    setShowCommitModal(false)
    setCommitStatus('committing')
    setCommitMsg('Schreibe 3 lang-Dateien ins Repo…')

    try {
      const res = await fetch('/api/lang-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rowsRef.current,
          message: `chore: Translations aktualisiert via Admin Panel (${changedKeys.size} Änderungen)`,
        }),
      })
      const data = await res.json() as { ok?: boolean; committedKeys?: number; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)

      setCommitStatus('success')
      setCommitMsg(`✓ ${data.committedKeys} Keys in de.json / en.json / ar.json committed`)
      setChangedKeys(new Set())
      toast.success('Committed!', { detail: 'lang-Dateien im Repo aktualisiert. git pull lokal.' })
      log({ action: 'translations_committed', status: 'success', message: `${data.committedKeys} Keys committed`, details: { changed: changedKeys.size } })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setCommitStatus('error')
      setCommitMsg(msg)
      toast.error('Commit fehlgeschlagen', { detail: msg })
      log({ action: 'translations_commit_failed', status: 'error', error: msg })
    }

    setTimeout(() => { setCommitStatus('idle'); setCommitMsg('') }, 8000)
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const missingEn  = rows.filter(r => isMissing(r.en)).length
  const missingAr  = rows.filter(r => isMissing(r.ar)).length
  const missingAny = rows.filter(r => isMissing(r.en) || isMissing(r.ar)).length
  const isDirty    = changedKeys.size > 0

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <PageTransition className="space-y-6">

      <PageHeader
        title="Translations"
        subtitle="Portfolio-Texte in DE / EN / AR — Quelle: lang/*.json im Repo"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary" size="sm"
              loading={bulkTranslating}
              icon={<RotateCcw size={13} />}
              onClick={translateAllMissing}
            >
              Fehlende übersetzen
            </Button>
            <Button
              variant={isDirty ? 'primary' : 'secondary'}
              size="sm"
              loading={commitStatus === 'committing'}
              icon={<GitCommit size={13} />}
              onClick={() => isDirty ? setShowCommitModal(true) : toast.info('Keine Änderungen.')}
            >
              {isDirty ? `Commit (${changedKeys.size})` : 'Commit'}
            </Button>
          </div>
        }
      />

      {/* Commit Status Banner */}
      {commitMsg && (
        <div
          className="rounded-[var(--radius-md)] border px-4 py-3 text-sm flex items-center gap-2"
          style={{
            borderColor: commitStatus === 'success'
              ? 'rgba(48,209,88,.3)'
              : commitStatus === 'error'
              ? 'rgba(255,69,58,.3)'
              : 'rgba(10,132,255,.3)',
            background: commitStatus === 'success'
              ? 'rgba(48,209,88,.06)'
              : commitStatus === 'error'
              ? 'rgba(255,69,58,.06)'
              : 'rgba(10,132,255,.06)',
            color: commitStatus === 'success'
              ? 'var(--color-success)'
              : commitStatus === 'error'
              ? 'var(--color-danger)'
              : 'var(--color-accent)',
          }}
        >
          {commitMsg}
        </div>
      )}

      {/* Unsaved Changes Banner */}
      {isDirty && (
        <div
          className="rounded-[var(--radius-md)] border px-4 py-3 text-sm flex items-center gap-2"
          style={{ borderColor: 'rgba(255,214,10,.3)', background: 'rgba(255,214,10,.06)', color: 'var(--color-warning)' }}
        >
          <AlertCircle size={14} />
          <span><strong>{changedKeys.size}</strong> geänderte Key{changedKeys.size !== 1 ? 's'  : ''} — noch nicht ins Repo committed.</span>
        </div>
      )}

      {/* Load Error */}
      {loadError && (
        <div
          className="rounded-[var(--radius-md)] border px-4 py-3 text-sm flex items-center gap-2"
          style={{ borderColor: 'rgba(255,69,58,.3)', background: 'rgba(255,69,58,.06)', color: 'var(--color-danger)' }}
        >
          <XCircle size={14} />
          <span>Fehler beim Laden: {loadError}</span>
          <button className="ml-auto underline text-xs" onClick={loadData}>Erneut versuchen</button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Globe}     label="Gesamt Keys"    value={rows.length}  accent />
        <StatCard icon={Languages} label="DE vollständig" value={rows.filter(r => !isMissing(r.de)).length} />
        <StatCard icon={Languages} label="EN fehlt"       value={missingEn}    warn />
        <StatCard icon={Languages} label="AR fehlt"       value={missingAr}    warn />
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2 flex-wrap">
        <Input
          type="text"
          placeholder="Key oder Text suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
        <Select value={filterLang} onChange={e => setFilterLang(e.target.value as FilterLang)} className="w-56">
          <option value="all">Alle ({rows.length})</option>
          <option value="missing_en">EN fehlt ({missingEn})</option>
          <option value="missing_ar">AR fehlt ({missingAr})</option>
          <option value="missing_any">Irgendwas fehlt ({missingAny})</option>
        </Select>
        {(search || filterLang !== 'all') && (
          <Badge variant="accent">{filtered.length} Treffer</Badge>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-3)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Lade lang-Dateien aus GitHub…</span>
        </div>
      ) : (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--color-border)]" style={{ background: 'var(--color-surface-2)' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider w-52">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider">🇩🇪 DE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider">🇬🇧 EN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider">🇸🇦 AR</th>
                  <th className="px-4 py-3 w-14" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-sm text-[var(--color-text-3)]">
                      Keine Einträge gefunden.
                    </td>
                  </tr>
                )}
                {filtered.map((row, i) => {
                  const isTranslating = translating[row.key]
                  const isChanged     = changedKeys.has(row.key)
                  const isExpanded    = expandedKey === row.key
                  const hasLongText   = row.de.length > 80
                  const isEvenRow     = i % 2 === 0

                  return (
                    <tr
                      key={row.key}
                      className="border-b border-[var(--color-border)] last:border-0 transition-colors"
                      style={{
                        background: isEvenRow ? 'var(--color-surface-1)' : 'var(--color-surface-0)',
                        borderLeft: isChanged ? '2px solid rgba(255,214,10,.6)' : '2px solid transparent',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = isEvenRow ? 'var(--color-surface-1)' : 'var(--color-surface-0)')}
                    >
                      {/* Key + Status */}
                      <td className="px-4 py-3 align-top">
                        <code className="text-[11px] font-mono text-[var(--color-accent)] break-all leading-relaxed">{row.key}</code>
                        {isChanged && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--color-warning)]">
                            <AlertCircle size={9} />
                            <span>geändert</span>
                          </div>
                        )}
                      </td>

                      {/* DE */}
                      <td className="px-4 py-3 align-top">
                        {hasLongText && !isExpanded ? (
                          <div
                            className="text-xs text-[var(--color-text-2)] cursor-pointer"
                            onDoubleClick={() => setExpandedKey(row.key)}
                          >
                            {row.de.substring(0, 80)}…
                            <span className="text-[var(--color-text-3)] ml-1 text-[10px]">[Doppelklick]</span>
                          </div>
                        ) : (
                          <textarea
                            value={row.de}
                            onChange={e => handleChange(row.key, 'de', e.target.value)}
                            onBlur={() => isExpanded && setExpandedKey(null)}
                            rows={isExpanded ? 6 : 2}
                            className="w-full bg-transparent text-xs text-[var(--color-text-2)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50 rounded-[var(--radius-sm)] p-1 transition-shadow"
                          />
                        )}
                      </td>

                      {/* EN */}
                      <td className="px-4 py-3 align-top">
                        <textarea
                          value={row.en}
                          onChange={e => handleChange(row.key, 'en', e.target.value)}
                          rows={2}
                          placeholder="—"
                          className={`w-full bg-transparent text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50 rounded-[var(--radius-sm)] p-1 transition-shadow ${
                            isMissing(row.en) ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-2)]'
                          }`}
                        />
                      </td>

                      {/* AR */}
                      <td className="px-4 py-3 align-top">
                        <textarea
                          value={row.ar}
                          onChange={e => handleChange(row.key, 'ar', e.target.value)}
                          rows={2}
                          placeholder="—"
                          dir="rtl"
                          className={`w-full bg-transparent text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50 rounded-[var(--radius-sm)] p-1 transition-shadow ${
                            isMissing(row.ar) ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-2)]'
                          }`}
                        />
                      </td>

                      {/* Action: DeepL */}
                      <td className="px-3 py-3 align-top">
                        <button
                          onClick={() => translateRow(row)}
                          disabled={isTranslating || !row.de.trim()}
                          title="DE → EN + AR via DeepL"
                          className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] disabled:opacity-30 transition-all"
                        >
                          {isTranslating
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Zap size={13} />
                          }
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commit Modal */}
      <Modal
        open={showCommitModal}
        onClose={() => setShowCommitModal(false)}
        title="Ins GitHub-Repo committen?"
        width="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-2)]">
            Die aktuellen Werte aller <strong>{rows.length} Keys</strong> werden in
            <code className="mx-1 text-[var(--color-accent)]">lang/de.json</code>
            <code className="mx-1 text-[var(--color-accent)]">lang/en.json</code>
            <code className="mx-1 text-[var(--color-accent)]">lang/ar.json</code>
            im Repo geschrieben (<strong>{changedKeys.size} geänderte Keys</strong>).
          </p>
          <p className="text-xs text-[var(--color-text-3)]">
            Danach <code>git pull</code> lokal ausführen, damit die Änderungen beim
            Build-Test sichtbar sind.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowCommitModal(false)}>
              Abbrechen
            </Button>
            <Button
              variant="primary" size="sm"
              icon={<GitCommit size={13} />}
              loading={commitStatus === 'committing'}
              onClick={commitToGitHub}
            >
              Commit
            </Button>
          </div>
        </div>
      </Modal>

    </PageTransition>
  )
}
