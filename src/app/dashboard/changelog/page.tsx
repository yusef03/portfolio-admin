'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/components/Toast'
import { PageHeader, Button, Badge, PageTransition, Modal, Field, Input, Textarea, Segmented, LangTabs, Switch } from '@/components/ui'
import { Plus, Rocket, Loader2, ScrollText, Pencil, Trash2, Sparkles, Wrench, RefreshCcw, ShieldCheck, Search, Tag, CheckCircle2, FileEdit } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

const CATEGORY_META: Record<Category, { label: string; color: string; icon: typeof Sparkles }> = {
  feature:  { label: 'Feature',  color: '#0A84FF', icon: Sparkles },
  fix:      { label: 'Fix',      color: '#30D158', icon: Wrench },
  refactor: { label: 'Refactor', color: '#64D2FF', icon: RefreshCcw },
  security: { label: 'Security', color: '#FF453A', icon: ShieldCheck },
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
    <Modal open onClose={onCancel} title={isNew ? 'Neuer Release' : 'Release bearbeiten'} width="lg">
      <div className="space-y-5">
        {/* Version + Datum */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Version" required>
            <Input
              value={form.version}
              onChange={e => set('version', e.target.value)}
              placeholder="v1.4.0"
              className="font-mono"
              style={versionTaken ? { borderColor: 'var(--color-danger)' } : undefined}
            />
            {versionTaken && <p className="text-[var(--color-danger)] text-[11px] mt-1">Version existiert bereits</p>}
          </Field>
          <Field label="Datum">
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
        </div>

        {/* Kategorie */}
        <Field label="Kategorie">
          <Segmented<Category>
            value={form.category} onChange={(c) => set('category', c)}
            options={[{id:'feature',label:'Feature'},{id:'fix',label:'Fix'},{id:'refactor',label:'Refactor'},{id:'security',label:'Security'}]}
          />
        </Field>

        {/* Sprache */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-3)]">Inhalt</span>
          <LangTabs<ActiveLang> value={lang} onChange={setLang}
            langs={[{id:'de',label:'DE',done:!!form.title_de},{id:'en',label:'EN',done:!!form.title_en},{id:'ar',label:'AR',done:!!form.title_ar}]} />
        </div>

        <Field label="Titel">
          <Input value={form[titleKey]} onChange={e => set(titleKey, e.target.value)} placeholder={`Titel auf ${lang.toUpperCase()}…`} dir={lang === 'ar' ? 'rtl' : 'ltr'} />
        </Field>
        <Field label="Beschreibung" hint="was wurde geliefert">
          <Textarea value={form[descKey]} onChange={e => set(descKey, e.target.value)} placeholder={`Beschreibung auf ${lang.toUpperCase()}…`} rows={3} dir={lang === 'ar' ? 'rtl' : 'ltr'} />
        </Field>

        {/* Published */}
        <div className="flex items-center justify-between rounded-[12px] border px-4 py-3"
          style={{ borderColor: form.published ? 'rgba(48,209,88,.3)' : 'var(--color-border)', background: form.published ? 'rgba(48,209,88,.06)' : 'var(--color-surface-1)' }}>
          <div>
            <p className="text-[13px] font-medium text-[var(--color-text-1)]">{form.published ? 'Veröffentlicht' : 'Entwurf'}</p>
            <p className="text-[11px] text-[var(--color-text-3)] mt-0.5">{form.published ? 'Erscheint nach Publish auf der Seite' : 'Noch nicht öffentlich'}</p>
          </div>
          <Switch checked={form.published} onChange={(v) => set('published', v)} variant="success" />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" size="md" onClick={onCancel}>Abbrechen</Button>
          <Button variant="primary" size="md" disabled={!canSave} onClick={() => canSave && onSave(form)}>Speichern</Button>
        </div>
      </div>
    </Modal>
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
  const [filterCat, setFilterCat] = useState<Category | 'all'>('all')
  const [search, setSearch] = useState('')

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

  // ── Abgeleitete Daten ────────────────────────────────────────────────────────
  const publishedCount = entries.filter(e => e.published).length
  const draftCount = entries.length - publishedCount
  const latest = entries.find(e => e.published) ?? entries[0]
  const catCounts: Record<Category, number> = { feature: 0, fix: 0, refactor: 0, security: 0 }
  entries.forEach(e => { catCounts[e.category]++ })

  const filtered = entries.filter(e => {
    if (filterCat !== 'all' && e.category !== filterCat) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return e.version.toLowerCase().includes(q) || e.title_de.toLowerCase().includes(q) || (e.title_en ?? '').toLowerCase().includes(q)
    }
    return true
  })

  // Gruppierung nach Jahr für die Timeline
  const byYear: Record<string, ChangelogEntry[]> = {}
  filtered.forEach(e => { const y = (e.date || '').slice(0, 4) || '—'; (byYear[y] ??= []).push(e) })
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a))

  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d } }

  return (
    <PageTransition className="max-w-3xl mx-auto space-y-5">
      <PageHeader
        title="Changelog"
        subtitle="Release-Historie — dreisprachig, versioniert"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={() => { setEditEntry({ ...EMPTY_ENTRY }); setIsNewEntry(true) }}>Release</Button>
            <Button variant="primary" size="sm" loading={publishing} icon={<Rocket size={13} />} onClick={handlePublish}>
              {publishStatus === 'success' ? '✓ Gestartet' : 'Publish'}
            </Button>
          </div>
        }
      />

      {/* ── Overview ─────────────────────────────────────────── */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Latest */}
          <div className="rounded-[16px] border p-4 col-span-2 lg:col-span-1" style={{ background: 'linear-gradient(165deg, var(--color-surface-1), var(--color-surface-0) 140%)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-3)] mb-1.5"><Tag size={12} /> Neueste Version</div>
            <p className="text-[22px] font-bold font-mono tracking-tight text-[var(--color-text-1)] leading-none">{latest?.version ?? '—'}</p>
            <p className="text-[11px] text-[var(--color-text-3)] mt-1.5">{latest ? fmtDate(latest.date) : ''}</p>
          </div>
          {/* Gesamt */}
          <div className="rounded-[16px] border p-4 flex flex-col justify-between" style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-3)] mb-1.5"><ScrollText size={12} /> Releases</div>
            <p className="text-[26px] font-semibold tracking-tight text-[var(--color-text-1)] leading-none tabular-nums">{entries.length}</p>
          </div>
          {/* Live / Entwurf */}
          <div className="rounded-[16px] border p-4 flex flex-col justify-between" style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-3)] mb-1.5">Status</div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[13px]"><CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} /><strong className="text-[var(--color-text-1)] tabular-nums">{publishedCount}</strong> <span className="text-[var(--color-text-3)]">Live</span></span>
              <span className="flex items-center gap-1.5 text-[13px]"><FileEdit size={14} className="text-[var(--color-text-3)]" /><strong className="text-[var(--color-text-1)] tabular-nums">{draftCount}</strong> <span className="text-[var(--color-text-3)]">Entwurf</span></span>
            </div>
          </div>
          {/* Kategorien */}
          <div className="rounded-[16px] border p-4 col-span-2 lg:col-span-1" style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-3)] mb-2">Kategorien</div>
            <div className="h-2 rounded-full overflow-hidden flex gap-px mb-2" style={{ background: 'var(--color-surface-2)' }}>
              {(Object.keys(catCounts) as Category[]).map(c => catCounts[c] > 0 && (
                <div key={c} className="h-full" style={{ width: `${(catCounts[c] / entries.length) * 100}%`, background: CATEGORY_META[c].color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
              {(Object.keys(catCounts) as Category[]).filter(c => catCounts[c] > 0).map(c => (
                <span key={c} className="flex items-center gap-1 text-[10px] text-[var(--color-text-2)]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_META[c].color }} />{CATEGORY_META[c].label} {catCounts[c]}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar: Filter + Suche ──────────────────────────── */}
      {!loading && entries.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-[10px] border overflow-x-auto max-w-full no-scrollbar" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
            {(['all', 'feature', 'fix', 'refactor', 'security'] as const).map(c => {
              const active = filterCat === c
              const col = c === 'all' ? 'var(--color-text-1)' : CATEGORY_META[c as Category].color
              return (
                <button key={c} onClick={() => setFilterCat(c)}
                  className="px-2.5 py-1 rounded-[7px] text-xs font-medium transition-all shrink-0 whitespace-nowrap"
                  style={{ background: active ? 'var(--color-surface-1)' : 'transparent', color: active ? col : 'var(--color-text-3)', boxShadow: active ? '0 1px 3px rgba(0,0,0,.18)' : 'none' }}>
                  {c === 'all' ? `Alle (${entries.length})` : `${CATEGORY_META[c as Category].label} (${catCounts[c as Category]})`}
                </button>
              )
            })}
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-3)] pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Version oder Titel…" className="pl-9" />
          </div>
        </div>
      )}

      {/* Info */}
      {!loading && entries.length > 0 && (
        <div className="rounded-[var(--radius-md)] border px-3 py-2.5 text-xs"
          style={{ borderColor:'rgba(100,210,255,.2)', background:'rgba(100,210,255,.05)', color:'var(--color-info)' }}>
          Nur <strong>veröffentlichte</strong> Releases erscheinen nach „Publish" auf der öffentlichen <code className="bg-[var(--color-surface-2)] px-1 rounded">/roadmap</code>-Seite.
        </div>
      )}

      {/* ── Timeline ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-3)]">
          <Loader2 size={18} className="animate-spin" /><span className="text-sm">Lädt…</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)]">
          <ScrollText size={32} strokeWidth={1} className="text-[var(--color-text-3)]" />
          <p className="text-sm text-[var(--color-text-3)]">Noch keine Releases — klicke „+ Release" um den ersten anzulegen.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 text-center text-sm text-[var(--color-text-3)]">Keine Releases für diesen Filter.</div>
      ) : (
        <div className="relative pl-1">
          {/* Rail */}
          <div className="absolute left-[10px] top-3 bottom-3 w-px pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, var(--color-border-strong), var(--color-border) 80%, transparent)' }} />

          <AnimatePresence mode="popLayout">
            {years.map(year => (
              <div key={year} className="mb-2">
                {/* Year marker */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="relative z-10 w-[22px] flex justify-center">
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-[5px]" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-3)' }}>{year.slice(2)}</span>
                  </span>
                </div>

                {byYear[year].map(entry => {
                  const cat = CATEGORY_META[entry.category]
                  const Ico = cat.icon
                  return (
                    <motion.div key={entry.id} layout
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="group relative flex gap-4 mb-2">
                      {/* Version node */}
                      <div className="relative w-[22px] shrink-0 flex justify-center pt-[14px]">
                        <span className="relative z-10 w-7 h-7 rounded-[9px] flex items-center justify-center -ml-[10px]"
                          style={{ background: `color-mix(in srgb, ${cat.color} 16%, var(--color-surface-1))`, boxShadow: '0 0 0 4px var(--color-surface-0)' }}>
                          <Ico size={13} style={{ color: cat.color }} strokeWidth={2} />
                        </span>
                      </div>

                      {/* Card */}
                      <div className={`flex-1 min-w-0 rounded-[14px] border transition-all duration-200 hover:-translate-y-px ${!entry.published ? 'opacity-65' : ''}`}
                        style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 10px 30px -14px rgba(0,0,0,.5)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)' }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-border)' }}>
                        <div className="flex items-start gap-3 p-3.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <code className="text-[13px] font-mono font-bold text-[var(--color-text-1)]">{entry.version}</code>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[5px]" style={{ background: `color-mix(in srgb, ${cat.color} 14%, transparent)`, color: cat.color }}>{cat.label}</span>
                              {entry === latest && entry.published && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[5px]" style={{ background: 'rgba(48,209,88,.14)', color: 'var(--color-success)' }}>Latest</span>
                              )}
                              <span className="text-[11px] font-mono text-[var(--color-text-3)]">{fmtDate(entry.date)}</span>
                            </div>
                            <p className="text-[14px] font-semibold text-[var(--color-text-1)] mt-1.5 truncate">
                              {entry.title_de || <span className="text-[var(--color-text-3)] italic font-normal">Kein Titel</span>}
                            </p>
                            {entry.description_de && <p className="text-[12px] text-[var(--color-text-3)] mt-1 line-clamp-2">{entry.description_de}</p>}
                          </div>

                          {/* Right: publish toggle + hover actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => togglePublished(entry)} title={entry.published ? 'Live — klicken für Entwurf' : 'Entwurf — klicken zum Veröffentlichen'}>
                              <Badge variant={entry.published ? 'success' : 'default'} dot>{entry.published ? 'Live' : 'Entwurf'}</Badge>
                            </button>
                            <button onClick={() => { setEditEntry(entry); setIsNewEntry(false) }} title="Bearbeiten"
                              className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                              <Pencil size={13} strokeWidth={1.75} />
                            </button>
                            <button onClick={() => deleteEntry(entry.id)} title="Löschen"
                              className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                              <Trash2 size={13} strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ))}
          </AnimatePresence>
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
    </PageTransition>
  )
}
