'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
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
  planned: { label: 'Geplant', color: 'text-gray-400', dot: 'bg-gray-500' },
  'in-progress': { label: 'In Arbeit', color: 'text-violet-400', dot: 'bg-violet-500 animate-pulse' },
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
      style={style}
      className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg group hover:border-gray-700 transition-colors"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing px-1 text-lg leading-none select-none"
        title="Ziehen zum Sortieren"
      >
        ⠿
      </button>

      {/* Status dot */}
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.dot}`} />

      {/* Titel */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{entry.title_de || <span className="text-gray-600 italic">Kein Titel</span>}</p>
        {entry.phase_label_de && (
          <p className="text-gray-500 text-xs mt-0.5 truncate">{entry.phase_label_de}</p>
        )}
        {entry.description_de && (
          <p className="text-gray-500 text-xs mt-0.5 truncate">{entry.description_de}</p>
        )}
      </div>

      {/* Status-Chip */}
      <span className={`text-xs px-2 py-0.5 rounded-full border border-gray-700 ${st.color} flex-shrink-0`}>
        {st.label}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {showChangelogBtn && entry.status === 'completed' && (
          <button
            onClick={() => onDraftChangelog(entry)}
            title="Changelog-Entwurf erstellen"
            className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-400 hover:bg-green-900/60 border border-green-800 transition-colors"
          >
            → CL
          </button>
        )}
        <button
          onClick={() => onEdit(entry)}
          className="text-gray-500 hover:text-white p-1.5 rounded hover:bg-gray-800 transition-colors text-sm"
          title="Bearbeiten"
        >
          ✎
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          className="text-gray-600 hover:text-red-400 p-1.5 rounded hover:bg-gray-800 transition-colors text-sm"
          title="Löschen"
        >
          🗑
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
      <div className="bg-gray-950 border border-gray-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <h3 className="text-white font-bold text-lg mb-5">
          {initial.id ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
        </h3>

        {/* Status */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Status</label>
          <div className="flex gap-2">
            {(['planned', 'in-progress', 'completed'] as const).map(s => (
              <button
                key={s}
                onClick={() => set('status', s)}
                className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                  form.status === s
                    ? 'border-violet-500 bg-violet-900/30 text-violet-300'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
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
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
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

        {/* Beschreibung (Warum) */}
        <div className="mb-3">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">
            Warum / Beschreibung <span className="text-gray-600 normal-case">(optional)</span>
          </label>
          <textarea
            value={form[descKey]}
            onChange={e => set(descKey, e.target.value)}
            placeholder={`Das 'Warum' auf ${lang.toUpperCase()}…`}
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 resize-none"
          />
        </div>

        {/* Phasen-Label */}
        <div className="mb-5">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">
            Phasen-Label <span className="text-gray-600 normal-case">(optional — z.B. &quot;Sprint 1-2&quot;, &quot;v1.0 Ziel&quot;)</span>
          </label>
          <input
            type="text"
            value={form[phaseKey]}
            onChange={e => set(phaseKey, e.target.value)}
            placeholder={`Label auf ${lang.toUpperCase()}…`}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onSave(form)}
            className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
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

export default function RoadmapPage() {
  const { showToast } = useToast()

  // Scope: 'portfolio' | project_slug string
  const [scope, setScope] = useState<string>('portfolio')
  const [projects, setProjects] = useState<Project[]>([])
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

  // Lade Projects für Scope-Dropdown
  useEffect(() => {
    supabase
      .from('projects')
      .select('id,slug,title')
      .order('sort_order')
      .then(({ data }) => setProjects(data ?? []))
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
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Roadmaps</h2>
          <p className="text-gray-400 text-sm mt-1">Verwalte alle Roadmap-Einträge — global und pro Projekt</p>
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

      {/* Scope-Auswahl */}
      <div className="flex items-center gap-3 mb-5">
        <label className="text-xs text-gray-400 uppercase tracking-widest flex-shrink-0">Scope:</label>
        <select
          value={scope}
          onChange={e => { setScope(e.target.value); setEditEntry(null) }}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
        >
          <option value="portfolio">🌐 Portfolio (global)</option>
          {projects.map(p => (
            <option key={p.slug} value={p.slug}>📁 Projekt: {p.title}</option>
          ))}
        </select>
        <button
          onClick={() => { setEditEntry({ ...EMPTY_ENTRY }); setIsNewEntry(true) }}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors flex-shrink-0"
        >
          + Eintrag
        </button>
      </div>

      {/* Scope-Info für Portfolio */}
      {scope === 'portfolio' && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg text-xs text-blue-300">
          <strong>Portfolio-Scope:</strong> Diese Einträge erscheinen auf der öffentlichen <code>/roadmap</code>-Seite.
          Erledigte Einträge können per &quot;→ CL&quot; als Changelog-Entwurf übernommen werden.
        </div>
      )}
      {scope !== 'portfolio' && (
        <div className="mb-4 p-3 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-400">
          <strong>Projekt-Scope:</strong> Diese Einträge erscheinen auf der Projektseite von <strong>{scopeLabel}</strong>.
          Alle Stati (inkl. ✓ fertig) werden angezeigt — das ist die Projekt-Story.
        </div>
      )}

      {/* Einträge-Liste */}
      {loading ? (
        <div className="text-gray-500 text-sm text-center py-12">Lädt…</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-gray-600 border border-dashed border-gray-800 rounded-xl">
          <p className="text-lg mb-2">Noch keine Einträge</p>
          <p className="text-sm">Klicke &quot;+ Eintrag&quot; um den ersten hinzuzufügen.</p>
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
    </div>
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
  const [title_de, setTitleDe] = useState(entry.title_de)
  const [title_en, setTitleEn] = useState(entry.title_en)
  const [description_de, setDescDe] = useState(entry.description_de)
  const [description_en, setDescEn] = useState(entry.description_en)
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
      title_de, title_en, title_ar: '',
      description_de, description_en, description_ar: '',
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
      <div className="bg-gray-950 border border-gray-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <h3 className="text-white font-bold text-lg mb-1">Changelog-Entwurf erstellen</h3>
        <p className="text-gray-400 text-xs mb-5">
          Erstellt einen Entwurf im Changelog-Bereich. Du schreibst den finalen Text selbst.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Version *</label>
            <input
              type="text"
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="v2.3.0"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Datum</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Kategorie</label>
          <div className="flex gap-2">
            {(['feature', 'fix', 'refactor', 'security'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex-1 py-1.5 rounded text-xs border transition-colors capitalize ${
                  category === c ? 'border-violet-500 bg-violet-900/30 text-violet-300' : 'border-gray-700 text-gray-400'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-2">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Titel (DE)</label>
          <input type="text" value={title_de} onChange={e => setTitleDe(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
        </div>
        <div className="mb-2">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Titel (EN)</label>
          <input type="text" value={title_en} onChange={e => setTitleEn(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
        </div>
        <div className="mb-2">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Beschreibung (DE)</label>
          <textarea value={description_de} onChange={e => setDescDe(e.target.value)} rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 resize-none" />
        </div>
        <div className="mb-5">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Beschreibung (EN)</label>
          <textarea value={description_en} onChange={e => setDescEn(e.target.value)} rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 resize-none" />
        </div>

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Speichere…' : 'Als Entwurf erstellen'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
