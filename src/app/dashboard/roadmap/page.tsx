'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { PageHeader, Button, Select, Badge, PageTransition, Modal, Field, LangTabs, Segmented, Input, Textarea } from '@/components/ui'
import { Rocket, Plus, Loader2, MapPinned } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useToast } from '@/components/Toast'
import type { RoadmapEntry, RoadmapScope, Project } from '@/lib/types'

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
      body: JSON.stringify({ ...payload, category: 'roadmap' }),
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

const EMPTY_ENTRY: Omit<RoadmapEntry, 'id' | 'created_at' | 'updated_at'> = {
  scope: 'portfolio',
  project_slug: null,
  title_de: '', title_en: '', title_ar: '',
  description_de: '', description_en: '', description_ar: '',
  phase_label_de: '', phase_label_en: '', phase_label_ar: '',
  status: 'planned',
  sort_order: 0,
}

const STATUS_LABELS = {
  planned: { label: 'Geplant', color: 'text-[var(--color-text-2)]', dot: 'bg-gray-500' },
  'in-progress': { label: 'In Arbeit', color: 'text-[var(--color-accent)]', dot: 'bg-[var(--color-brand)] animate-pulse' },
  completed: { label: 'Fertig', color: 'text-green-400', dot: 'bg-green-500' },
}

// ─── Draggable Row ────────────────────────────────────────────────────────────

function SortableRow({
  entry,
  onEdit,
  onDelete,
  onDraftChangelog,
  showChangelogBtn,
}: {
  entry: RoadmapEntry
  onEdit: (e: RoadmapEntry) => void
  onDelete: (id: string) => void
  onDraftChangelog: (e: RoadmapEntry) => void
  showChangelogBtn: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const st = STATUS_LABELS[entry.status]
  const accent = entry.status === 'completed' ? 'var(--color-success)' : entry.status === 'in-progress' ? 'var(--color-brand)' : 'var(--color-text-3)'

  return (
    <div ref={setNodeRef} style={style} className="group relative flex gap-4">

      {/* ── Timeline node column ──────────────────────────── */}
      <div className="relative w-[22px] shrink-0 flex justify-center pt-[18px]">
        <StatusNode status={entry.status} />
      </div>

      {/* ── Card ──────────────────────────────────────────── */}
      <div
        className="flex-1 min-w-0 mb-1 rounded-[14px] border transition-all duration-200 hover:-translate-y-px"
        style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)', borderLeft: `2px solid ${accent}` }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 10px 30px -14px rgba(0,0,0,.5)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.borderLeftColor = accent }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.borderLeftColor = accent }}
      >
        <div className="flex items-start gap-2.5 p-3.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {entry.phase_label_de && (
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-[5px]"
                  style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}>
                  {entry.phase_label_de}
                </span>
              )}
              <span className="text-[11px] font-medium" style={{ color: accent }}>{st.label}</span>
            </div>
            <p className="text-[var(--color-text-1)] text-[14px] font-semibold mt-1.5 truncate">
              {entry.title_de || <span className="text-[var(--color-text-3)] italic font-normal">Kein Titel</span>}
            </p>
            {entry.description_de && (
              <p className="text-[var(--color-text-3)] text-[12px] mt-1 line-clamp-2">{entry.description_de}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button {...attributes} {...listeners} title="Ziehen zum Sortieren"
              className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--color-border-strong)] hover:text-[var(--color-text-2)] cursor-grab active:cursor-grabbing touch-none opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor"><circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/><circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/></svg>
            </button>
            {showChangelogBtn && entry.status === 'completed' && (
              <button onClick={() => onDraftChangelog(entry)} title="Changelog-Entwurf erstellen"
                className="text-[11px] px-2 py-1 rounded-[7px] font-medium text-[var(--color-success)] bg-[var(--color-success)]/10 hover:bg-[var(--color-success)]/20 border border-[var(--color-success)]/20 transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                → CL
              </button>
            )}
            <button onClick={() => onEdit(entry)} title="Bearbeiten"
              className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button onClick={() => onDelete(entry.id)} title="Löschen"
              className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Timeline Status Node ──────────────────────────────────────────────────────

function StatusNode({ status }: { status: RoadmapEntry['status'] }) {
  const halo = '0 0 0 4px var(--color-surface-0)'
  if (status === 'completed') {
    return (
      <span className="relative z-10 w-[18px] h-[18px] rounded-full flex items-center justify-center"
        style={{ background: 'var(--color-success)', boxShadow: `${halo}, 0 0 12px rgba(48,209,88,.45)` }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.65)" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
    )
  }
  if (status === 'in-progress') {
    return (
      <span className="relative z-10 w-[18px] h-[18px] rounded-full" style={{ background: 'var(--color-surface-0)', border: '2.5px solid var(--color-brand)', boxShadow: halo }}>
        <span className="absolute -inset-[3px] rounded-full animate-ping" style={{ border: '2px solid var(--color-brand)', opacity: 0.4 }} />
      </span>
    )
  }
  return <span className="relative z-10 w-[18px] h-[18px] rounded-full" style={{ background: 'var(--color-surface-0)', border: '2.5px solid var(--color-border-strong)', boxShadow: halo }} />
}

// ─── Progress Overview ─────────────────────────────────────────────────────────

function ProgressOverview({ entries }: { entries: RoadmapEntry[] }) {
  const total = entries.length
  if (total === 0) return null
  const done = entries.filter(e => e.status === 'completed').length
  const prog = entries.filter(e => e.status === 'in-progress').length
  const plan = entries.filter(e => e.status === 'planned').length
  const pct = Math.round((done / total) * 100)

  const legend = [
    { label: 'Fertig', n: done, c: 'var(--color-success)' },
    { label: 'In Arbeit', n: prog, c: 'var(--color-brand)' },
    { label: 'Geplant', n: plan, c: 'var(--color-text-3)' },
  ]

  return (
    <div className="rounded-[16px] border p-5" style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-3.5">
        <div>
          <p className="text-[12px] text-[var(--color-text-3)]">Fortschritt</p>
          <p className="text-[26px] font-semibold tracking-tight text-[var(--color-text-1)] leading-none mt-1">
            {pct}<span className="text-[15px]">%</span>
            <span className="text-[13px] text-[var(--color-text-3)] font-normal ml-2">abgeschlossen</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {legend.map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: l.c }} />
              <span className="text-[12px] text-[var(--color-text-2)]">{l.label}</span>
              <span className="text-[12px] font-semibold text-[var(--color-text-1)] tabular-nums">{l.n}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden flex gap-px" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${(done / total) * 100}%`, background: 'var(--color-success)' }} />
        <div className="h-full transition-all duration-500" style={{ width: `${(prog / total) * 100}%`, background: 'var(--color-brand)' }} />
      </div>
    </div>
  )
}

// ─── Editor Modal ─────────────────────────────────────────────────────────────

function EntryEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Partial<RoadmapEntry>
  onSave: (data: Omit<RoadmapEntry, 'id' | 'created_at' | 'updated_at'>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Omit<RoadmapEntry, 'id' | 'created_at' | 'updated_at'>>({
    ...EMPTY_ENTRY,
    ...initial,
  })
  const [lang, setLang] = useState<ActiveLang>('de')

  function set<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  const titleKey = `title_${lang}` as 'title_de' | 'title_en' | 'title_ar'
  const descKey = `description_${lang}` as 'description_de' | 'description_en' | 'description_ar'
  const phaseKey = `phase_label_${lang}` as 'phase_label_de' | 'phase_label_en' | 'phase_label_ar'

  const langDone = (l: ActiveLang) => Boolean(form[`title_${l}` as 'title_de'])

  return (
    <Modal open onClose={onCancel} title={initial.id ? 'Eintrag bearbeiten' : 'Neuer Eintrag'} width="lg">
      <div className="space-y-5">
        {/* Status */}
        <Field label="Status">
          <Segmented<typeof form.status>
            value={form.status}
            onChange={(s) => set('status', s)}
            options={[
              { id: 'planned', label: STATUS_LABELS.planned.label },
              { id: 'in-progress', label: STATUS_LABELS['in-progress'].label },
              { id: 'completed', label: STATUS_LABELS.completed.label },
            ]}
          />
        </Field>

        {/* Sprache + Felder */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-3)]">Inhalt</span>
          <LangTabs<ActiveLang>
            value={lang} onChange={setLang}
            langs={[
              { id: 'de', label: 'DE', done: langDone('de') },
              { id: 'en', label: 'EN', done: langDone('en') },
              { id: 'ar', label: 'AR', done: langDone('ar') },
            ]}
          />
        </div>

        <Field label="Titel">
          <Input value={form[titleKey]} onChange={e => set(titleKey, e.target.value)} placeholder={`Titel auf ${lang.toUpperCase()}…`} dir={lang === 'ar' ? 'rtl' : 'ltr'} />
        </Field>

        <Field label="Warum / Beschreibung" hint="optional">
          <Textarea value={form[descKey]} onChange={e => set(descKey, e.target.value)} placeholder={`Das „Warum" auf ${lang.toUpperCase()}…`} rows={2} dir={lang === 'ar' ? 'rtl' : 'ltr'} />
        </Field>

        <Field label="Phasen-Label" hint="z.B. Sprint 1-2, v1.0 Ziel">
          <Input value={form[phaseKey]} onChange={e => set(phaseKey, e.target.value)} placeholder={`Label auf ${lang.toUpperCase()}…`} dir={lang === 'ar' ? 'rtl' : 'ltr'} />
        </Field>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" size="md" onClick={onCancel}>Abbrechen</Button>
          <Button variant="primary" size="md" onClick={() => onSave(form)}>Speichern</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const toast = useToast()
  const showToast = (msg: string, type: 'success' | 'error' | 'info' | 'warning') => toast[type](msg)

  // Scope: 'portfolio' | project_slug string
  const [scope, setScope] = useState<string>('portfolio')
  const [projects, setProjects] = useState<Project[]>([])
  const [enabledSlugs, setEnabledSlugs] = useState<string[] | null>(null)
  const [entries, setEntries] = useState<RoadmapEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'running' | 'success' | 'failure'>('idle')
  const [editEntry, setEditEntry] = useState<Partial<RoadmapEntry> | null>(null)
  const [isNewEntry, setIsNewEntry] = useState(false)

  // Changelog-Entwurf modal
  const [clDraft, setClDraft] = useState<RoadmapEntry | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Lade Projects + roadmap_enabled_slugs (welche Projektseiten haben einen Roadmap-Bereich)
  useEffect(() => {
    supabase
      .from('projects')
      .select('id,slug,title')
      .order('sort_order')
      .then(({ data }) => setProjects((data ?? []) as unknown as Project[]))

    supabase
      .from('settings')
      .select('value')
      .eq('key', 'roadmap_enabled_slugs')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && Array.isArray(data.value)) {
          setEnabledSlugs(data.value as string[])
        } else {
          setEnabledSlugs([]) // Fallback: Setting nicht gefunden → alle anzeigen
        }
      })
  }, [])

  // Lade Roadmap-Einträge für aktuellen Scope
  const loadEntries = useCallback(async () => {
    setLoading(true)
    const query = scope === 'portfolio'
      ? supabase.from('roadmap').select('*').eq('scope', 'portfolio').order('sort_order')
      : supabase.from('roadmap').select('*').eq('scope', 'project').eq('project_slug', scope).order('sort_order')

    const { data, error } = await query
    if (error) {
      showToast('Fehler beim Laden der Einträge', 'error')
    } else {
      setEntries(data ?? [])
    }
    setLoading(false)
  }, [scope])

  useEffect(() => { loadEntries() }, [loadEntries])

  // ── Save Entry ──────────────────────────────────────────────────────────────

  async function saveEntry(form: Omit<RoadmapEntry, 'id' | 'created_at' | 'updated_at'>) {
    // Scope aus aktuellem Dropdown setzen
    const scopeVal: RoadmapScope = scope === 'portfolio' ? 'portfolio' : 'project'
    const projectSlug = scope === 'portfolio' ? null : scope

    const payload = {
      ...form,
      scope: scopeVal,
      project_slug: projectSlug,
      sort_order: isNewEntry ? (entries.length > 0 ? Math.max(...entries.map(e => e.sort_order)) + 10 : 0) : form.sort_order,
      updated_at: new Date().toISOString(),
    }

    let error
    if (isNewEntry) {
      const res = await supabase.from('roadmap').insert(payload)
      error = res.error
    } else if (editEntry?.id) {
      const res = await supabase.from('roadmap').update(payload).eq('id', editEntry.id)
      error = res.error
    }

    if (error) {
      showToast(`Fehler beim Speichern: ${error.message}`, 'error')
      await log({ action: isNewEntry ? 'create' : 'update', status: 'error', error: error.message })
    } else {
      showToast(isNewEntry ? 'Eintrag erstellt' : 'Eintrag gespeichert', 'success')
      await log({ action: isNewEntry ? 'create' : 'update', status: 'success', message: form.title_de })
      setEditEntry(null)
      setIsNewEntry(false)
      loadEntries()
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function deleteEntry(id: string) {
    const entry = entries.find(e => e.id === id)
    if (!confirm(`Eintrag "${entry?.title_de || id}" wirklich löschen?`)) return
    const { error } = await supabase.from('roadmap').delete().eq('id', id)
    if (error) {
      showToast(`Fehler: ${error.message}`, 'error')
    } else {
      showToast('Eintrag gelöscht', 'success')
      await log({ action: 'delete', status: 'success', message: entry?.title_de })
      loadEntries()
    }
  }

  // ── Drag & Drop → sort_order ──────────────────────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = entries.findIndex(e => e.id === active.id)
    const newIdx = entries.findIndex(e => e.id === over.id)
    const reordered = arrayMove(entries, oldIdx, newIdx)
    setEntries(reordered)

    // sort_order in DB aktualisieren
    const updates = reordered.map((e, i) => ({ id: e.id, sort_order: i * 10 }))
    for (const u of updates) {
      await supabase.from('roadmap').update({ sort_order: u.sort_order }).eq('id', u.id)
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
        await log({ action: 'publish', status: 'success', message: 'publish-roadmap.yml ausgelöst' })
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

  // ── Changelog-Entwurf ─────────────────────────────────────────────────────

  function openChangelogDraft(entry: RoadmapEntry) {
    setClDraft(entry)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const scopeLabel = scope === 'portfolio'
    ? 'Portfolio (global)'
    : projects.find(p => p.slug === scope)?.title ?? scope

  return (
    <PageTransition className="max-w-2xl mx-auto space-y-5">
      <PageHeader
        title="Roadmap"
        subtitle="Roadmap-Einträge verwalten — global und pro Projekt"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Plus size={13} />}
              onClick={() => { setEditEntry({ ...EMPTY_ENTRY }); setIsNewEntry(true) }}>
              Eintrag
            </Button>
            <Button variant="primary" size="sm" loading={publishing} icon={<Rocket size={13} />} onClick={handlePublish}>
              {publishStatus === 'success' ? '✓ Gestartet' : 'Publish'}
            </Button>
          </div>
        }
      />

      {/* Scope-Auswahl */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-text-3)] uppercase tracking-wider font-medium shrink-0">Scope</span>
        <Select value={scope} onChange={e => { setScope(e.target.value); setEditEntry(null) }} className="flex-1">
          <option value="portfolio">🌐 Portfolio (global)</option>
          {(enabledSlugs && enabledSlugs.length > 0 ? projects.filter(p => enabledSlugs.includes(p.slug)) : projects)
            .map(p => <option key={p.slug} value={p.slug}>📁 {p.title}</option>)}
        </Select>
      </div>

      {/* Scope-Info */}
      <div className="rounded-[var(--radius-md)] border px-3 py-2.5 text-xs"
        style={{
          borderColor: scope === 'portfolio' ? 'rgba(0,229,255,.2)' : 'var(--color-border)',
          background: scope === 'portfolio' ? 'rgba(0,229,255,.04)' : 'var(--color-surface-1)',
          color: scope === 'portfolio' ? 'var(--color-accent)' : 'var(--color-text-2)',
        }}>
        {scope === 'portfolio'
          ? <><strong>Portfolio-Scope:</strong> Einträge erscheinen auf der öffentlichen <code className="bg-[var(--color-surface-2)] px-1 rounded">/roadmap</code>-Seite. Erledigte → per „→ CL" als Changelog-Entwurf.</>
          : <><strong>Projekt-Scope:</strong> Einträge erscheinen auf der Projektseite von <strong>{scopeLabel}</strong>. Alle Stati werden angezeigt — das ist die Projekt-Story.</>}
      </div>

      {/* Einträge */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-3)]">
          <Loader2 size={18} className="animate-spin" /><span className="text-sm">Lädt Einträge…</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)]">
          <MapPinned size={32} strokeWidth={1} className="text-[var(--color-text-3)]" />
          <p className="text-sm text-[var(--color-text-3)]">Noch keine Einträge — klicke „+ Eintrag" um den ersten hinzuzufügen.</p>
        </div>
      ) : (
        <>
          {/* Fortschritts-Übersicht */}
          <ProgressOverview entries={entries} />

          {/* Vertikale Timeline */}
          <div className="relative pt-1">
            {/* Rail line */}
            <div className="absolute left-[10px] top-6 bottom-6 w-px pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, var(--color-border-strong), var(--color-border) 70%, transparent)' }} />

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {entries.map(entry => (
                    <SortableRow
                      key={entry.id}
                      entry={entry}
                      onEdit={e => { setEditEntry(e); setIsNewEntry(false) }}
                      onDelete={deleteEntry}
                      onDraftChangelog={openChangelogDraft}
                      showChangelogBtn={scope === 'portfolio'}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </>
      )}

      {/* Editor Modal */}
      {editEntry && (
        <EntryEditor
          initial={editEntry}
          onSave={saveEntry}
          onCancel={() => { setEditEntry(null); setIsNewEntry(false) }}
        />
      )}

      {/* Changelog-Entwurf Modal */}
      {clDraft && (
        <ChangelogDraftModal entry={clDraft} onClose={() => setClDraft(null)} showToast={showToast} />
      )}
    </PageTransition>
  )
}

// ─── Changelog-Entwurf Modal ─────────────────────────────────────────────────

function ChangelogDraftModal({
  entry,
  onClose,
  showToast,
}: {
  entry: RoadmapEntry
  onClose: () => void
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void
}) {
  const [version, setVersion] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState<'feature' | 'fix' | 'refactor' | 'security'>('feature')
  const [lang, setLang] = useState<'de' | 'en' | 'ar'>('de')
  const [title_de, setTitleDe] = useState(entry.title_de)
  const [title_en, setTitleEn] = useState(entry.title_en)
  const [title_ar, setTitleAr] = useState(entry.title_ar || '')
  const [description_de, setDescDe] = useState(entry.description_de)
  const [description_en, setDescEn] = useState(entry.description_en)
  const [description_ar, setDescAr] = useState(entry.description_ar || '')
  const [saving, setSaving] = useState(false)

  const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function save() {
    if (!version.trim()) { showToast('Bitte Version eingeben (z.B. v2.3.0)', 'warning'); return }
    setSaving(true)
    const { error } = await supabaseClient.from('changelog').insert({
      version, date, category,
      title_de, title_en, title_ar,
      description_de, description_en, description_ar,
    })
    setSaving(false)
    if (error) {
      showToast(`Fehler: ${error.message}`, 'error')
    } else {
      showToast('Changelog-Entwurf erstellt — im Changelog-Bereich vollenden', 'success')
      onClose()
    }
  }

  const title = lang === 'de' ? title_de : lang === 'en' ? title_en : title_ar
  const desc = lang === 'de' ? description_de : lang === 'en' ? description_en : description_ar
  const setTitle = (v: string) => lang === 'de' ? setTitleDe(v) : lang === 'en' ? setTitleEn(v) : setTitleAr(v)
  const setDesc = (v: string) => lang === 'de' ? setDescDe(v) : lang === 'en' ? setDescEn(v) : setDescAr(v)

  return (
    <Modal open onClose={onClose} title="Changelog-Entwurf erstellen" width="lg">
      <div className="space-y-5">
        <p className="text-[13px] text-[var(--color-text-2)] -mt-1">Erstellt einen Entwurf im Changelog-Bereich. Den finalen Text schreibst du dort.</p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Version" required>
            <Input value={version} onChange={e => setVersion(e.target.value)} placeholder="v2.3.0" className="font-mono" />
          </Field>
          <Field label="Datum">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
        </div>

        <Field label="Kategorie">
          <Segmented<'feature'|'fix'|'refactor'|'security'>
            value={category} onChange={setCategory}
            options={[{id:'feature',label:'Feature'},{id:'fix',label:'Fix'},{id:'refactor',label:'Refactor'},{id:'security',label:'Security'}]}
          />
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-3)]">Inhalt</span>
          <LangTabs<'de'|'en'|'ar'> value={lang} onChange={setLang}
            langs={[{id:'de',label:'DE',done:!!title_de},{id:'en',label:'EN',done:!!title_en},{id:'ar',label:'AR',done:!!title_ar}]} />
        </div>

        <Field label={`Titel (${lang.toUpperCase()})`}>
          <Input value={title} onChange={e => setTitle(e.target.value)} dir={lang === 'ar' ? 'rtl' : 'ltr'} />
        </Field>
        <Field label={`Beschreibung (${lang.toUpperCase()})`}>
          <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} dir={lang === 'ar' ? 'rtl' : 'ltr'} />
        </Field>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" size="md" onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" size="md" loading={saving} onClick={save}>Als Entwurf erstellen</Button>
        </div>
      </div>
    </Modal>
  )
}
