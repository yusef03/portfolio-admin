'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { PageHeader, Button, Select, Badge, PageTransition } from '@/components/ui'
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
  'in-progress': { label: 'In Arbeit', color: 'text-[var(--color-accent)]', dot: 'bg-violet-500 animate-pulse' },
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

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}
      className="group flex items-center gap-2.5 px-3 py-3 rounded-[var(--radius-lg)] border transition-all duration-150 hover:border-[var(--color-brand)]/30 hover:shadow-[var(--glow-brand)] hover:-translate-y-px"
    >
      {/* Drag handle */}
      <button {...attributes} {...listeners}
        className="text-[var(--color-border-strong)] hover:text-[var(--color-text-3)] cursor-grab active:cursor-grabbing shrink-0 touch-none p-0.5"
        title="Ziehen zum Sortieren"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/><circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/></svg>
      </button>

      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot} ${entry.status === 'in-progress' ? 'animate-pulse' : ''}`} />

      {/* Titel */}
      <div className="flex-1 min-w-0">
        <p className="text-[var(--color-text-1)] text-sm font-medium truncate">
          {entry.title_de || <span className="text-[var(--color-text-3)] italic">Kein Titel</span>}
        </p>
        {(entry.phase_label_de || entry.description_de) && (
          <p className="text-[var(--color-text-3)] text-[11px] mt-0.5 truncate">
            {entry.phase_label_de}{entry.phase_label_de && entry.description_de ? ' · ' : ''}{entry.description_de}
          </p>
        )}
      </div>

      {/* Status Badge */}
      <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 font-medium ${st.color} border-current/20`}>
        {st.label}
      </span>

      {/* Actions — show on hover */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {showChangelogBtn && entry.status === 'completed' && (
          <button onClick={() => onDraftChangelog(entry)} title="Changelog-Entwurf"
            className="text-[11px] px-2 py-1 rounded-[var(--radius-sm)] font-medium text-[var(--color-success)] bg-[var(--color-success)]/10 hover:bg-[var(--color-success)]/20 border border-[var(--color-success)]/20 transition-colors">
            → CL
          </button>
        )}
        <button onClick={() => onEdit(entry)} title="Bearbeiten"
          className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button onClick={() => onDelete(entry.id)} title="Löschen"
          className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <h3 className="text-[var(--color-text-1)] font-bold text-lg mb-5">
          {initial.id ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
        </h3>

        {/* Status */}
        <div className="mb-4">
          <label className="block text-xs text-[var(--color-text-2)] uppercase tracking-widest mb-2">Status</label>
          <div className="flex gap-2">
            {(['planned', 'in-progress', 'completed'] as const).map(s => (
              <button
                key={s}
                onClick={() => set('status', s)}
                className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                  form.status === s
                    ? 'border-[var(--color-accent)] bg-[var(--color-brand)]/10 text-[var(--color-accent)]'
                    : 'border-[var(--color-border-strong)] text-[var(--color-text-2)] hover:border-[var(--color-border-strong)]'
                }`}
              >
                {STATUS_LABELS[s].label}
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
                lang === l
                  ? 'bg-[var(--color-brand)] text-[var(--color-text-1)]'
                  : 'text-[var(--color-text-2)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Titel */}
        <div className="mb-3">
          <label className="block text-xs text-[var(--color-text-2)] uppercase tracking-widest mb-1">Titel</label>
          <input
            type="text"
            value={form[titleKey]}
            onChange={e => set(titleKey, e.target.value)}
            placeholder={`Titel auf ${lang.toUpperCase()}…`}
            className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-[var(--color-text-1)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        {/* Beschreibung (Warum) */}
        <div className="mb-3">
          <label className="block text-xs text-[var(--color-text-2)] uppercase tracking-widest mb-1">
            Warum / Beschreibung <span className="text-[var(--color-text-3)] normal-case">(optional)</span>
          </label>
          <textarea
            value={form[descKey]}
            onChange={e => set(descKey, e.target.value)}
            placeholder={`Das 'Warum' auf ${lang.toUpperCase()}…`}
            rows={2}
            className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-[var(--color-text-1)] text-sm focus:outline-none focus:border-[var(--color-accent)] resize-none"
          />
        </div>

        {/* Phasen-Label */}
        <div className="mb-5">
          <label className="block text-xs text-[var(--color-text-2)] uppercase tracking-widest mb-1">
            Phasen-Label <span className="text-[var(--color-text-3)] normal-case">(optional — z.B. &quot;Sprint 1-2&quot;, &quot;v1.0 Ziel&quot;)</span>
          </label>
          <input
            type="text"
            value={form[phaseKey]}
            onChange={e => set(phaseKey, e.target.value)}
            placeholder={`Label auf ${lang.toUpperCase()}…`}
            className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-[var(--color-text-1)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onSave(form)}
            className="flex-1 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-[var(--color-text-1)] rounded-lg text-sm font-medium transition-colors"
          >
            Speichern
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-2)] rounded-lg text-sm transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
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

      {/* Einträge-Liste */}
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={entries.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <h3 className="text-[var(--color-text-1)] font-bold text-lg mb-1">Changelog-Entwurf erstellen</h3>
        <p className="text-[var(--color-text-2)] text-xs mb-5">
          Erstellt einen Entwurf im Changelog-Bereich. Du schreibst den finalen Text selbst.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-[var(--color-text-2)] uppercase tracking-widest mb-1">Version *</label>
            <input
              type="text"
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="v2.3.0"
              className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-[var(--color-text-1)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-2)] uppercase tracking-widest mb-1">Datum</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-[var(--color-text-1)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs text-[var(--color-text-2)] uppercase tracking-widest mb-1">Kategorie</label>
          <div className="flex gap-2">
            {(['feature', 'fix', 'refactor', 'security'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex-1 py-1.5 rounded text-xs border transition-colors capitalize ${
                  category === c ? 'border-[var(--color-accent)] bg-[var(--color-brand)]/10 text-[var(--color-accent)]' : 'border-[var(--color-border-strong)] text-[var(--color-text-2)]'
                }`}
              >
                {c}
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
                lang === l ? 'bg-[var(--color-brand)] text-[var(--color-text-1)]' : 'text-[var(--color-text-2)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="mb-2">
          <label className="block text-xs text-[var(--color-text-2)] uppercase tracking-widest mb-1">Titel ({lang.toUpperCase()})</label>
          <input
            type="text"
            value={lang === 'de' ? title_de : lang === 'en' ? title_en : title_ar}
            onChange={e => lang === 'de' ? setTitleDe(e.target.value) : lang === 'en' ? setTitleEn(e.target.value) : setTitleAr(e.target.value)}
            className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-[var(--color-text-1)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="mb-5">
          <label className="block text-xs text-[var(--color-text-2)] uppercase tracking-widest mb-1">Beschreibung ({lang.toUpperCase()})</label>
          <textarea
            value={lang === 'de' ? description_de : lang === 'en' ? description_en : description_ar}
            onChange={e => lang === 'de' ? setDescDe(e.target.value) : lang === 'en' ? setDescEn(e.target.value) : setDescAr(e.target.value)}
            rows={2}
            className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-[var(--color-text-1)] text-sm focus:outline-none focus:border-[var(--color-accent)] resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-[var(--color-text-1)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Speichere…' : 'Als Entwurf erstellen'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-2)] rounded-lg text-sm transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
