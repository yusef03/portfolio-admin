'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
import type { Project, GithubCard } from '@/lib/types'

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
      body: JSON.stringify({ ...payload, category: 'projects' }),
    })
  } catch { /* silent */ }
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Status Chip ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  'active':      'Active',
  'in-progress': 'In Progress',
  'completed':   'Completed',
}

const STATUS_COLORS: Record<string, string> = {
  'active':      'bg-green-900/40 text-green-400 border border-green-800',
  'in-progress': 'bg-purple-900/40 text-purple-400 border border-purple-800',
  'completed':   'bg-gray-800 text-gray-400 border border-gray-700',
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] ?? STATUS_COLORS['active']}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────

function SortableProjectRow({
  project,
  onSetHero,
  onDelete,
}: {
  project: Project
  onSetHero: (id: string) => void
  onDelete: (id: string, title: string) => void
}) {
  const router = useRouter()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 group"
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        aria-label="Zeile verschieben"
      >
        ⠿
      </button>

      {/* Image Preview */}
      {project.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.image_url}
          alt={project.title}
          className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-800"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-gray-800 shrink-0 flex items-center justify-center text-gray-600 text-xs">
          ?
        </div>
      )}

      {/* Title + Slug */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm truncate">{project.title}</span>
          {project.is_hero && (
            <span className="text-yellow-400 text-xs shrink-0">⭐ HERO</span>
          )}
        </div>
        <span className="text-gray-500 text-xs font-mono">{project.slug}</span>
      </div>

      {/* Status */}
      <div className="shrink-0">
        <StatusChip status={project.status} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {!project.is_hero && (
          <button
            onClick={() => onSetHero(project.id)}
            title="Als Hero setzen"
            className="p-1.5 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors text-sm"
          >
            ☆
          </button>
        )}
        <button
          onClick={() => router.push(`/dashboard/projects/${project.id}`)}
          title="Bearbeiten"
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors text-sm"
        >
          ✎
        </button>
        <button
          onClick={() => onDelete(project.id, project.title)}
          title="Löschen"
          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors text-sm"
        >
          🗑
        </button>
      </div>
    </div>
  )
}

// ─── GitHub Card Panel ────────────────────────────────────────────────────────

function GithubCardPanel() {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [card, setCard] = useState<GithubCard>({
    title_de: 'Mehr auf GitHub', title_en: 'More on GitHub', title_ar: 'المزيد على GitHub',
    text_de: 'Schau dir meine aktuellen Repositories, Experimente und Code-Snippets an.',
    text_en: 'Check out my latest repositories, experiments and code snippets.',
    text_ar: 'تصفح مستودعاتي الحديثة وتجاربي البرمجية.',
    btn_de: 'Zum Profil', btn_en: 'To Profile', btn_ar: 'إلى الملف الشخصي',
    url: 'https://github.com/yusef03',
  })

  useEffect(() => {
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'archive_github_card')
      .single()
      .then(({ data }) => {
        if (data?.value) setCard(data.value as GithubCard)
      })
  }, [])

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'archive_github_card', value: card, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setSaving(false)
    if (error) {
      toast.error('Fehler beim Speichern', { detail: error.message })
      log({ action: 'github_card_save_failed', status: 'error', error: error.message })
    } else {
      toast.success('GitHub-Karte gespeichert')
      log({ action: 'github_card_saved', status: 'success', message: 'archive_github_card aktualisiert' })
    }
  }

  const field = (key: keyof GithubCard, label: string, dir?: 'rtl') => (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={card[key] as string}
        onChange={e => setCard(prev => ({ ...prev, [key]: e.target.value }))}
        dir={dir}
        className="w-full px-3 py-1.5 text-sm rounded-lg bg-gray-950 border border-gray-700 text-white focus:outline-none focus:border-purple-500"
      />
    </div>
  )

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 transition-colors text-left"
      >
        <span className="text-sm font-medium text-gray-300">📌 Archiv-GitHub-Karte</span>
        <span className="text-gray-500 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="bg-gray-950 px-4 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {field('title_de', 'Titel DE')}
            {field('title_en', 'Titel EN')}
            {field('title_ar', 'Titel AR', 'rtl')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {field('text_de', 'Text DE')}
            {field('text_en', 'Text EN')}
            {field('text_ar', 'Text AR', 'rtl')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {field('btn_de', 'Button DE')}
            {field('btn_en', 'Button EN')}
            {field('btn_ar', 'Button AR', 'rtl')}
          </div>
          {field('url', 'GitHub URL')}
          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? '⏳ Speichert…' : '💾 Speichern'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Publish Button ───────────────────────────────────────────────────────────

type PublishStatus = 'idle' | 'publishing' | 'success' | 'error'

function PublishButton() {
  const toast = useToast()
  const [status, setStatus] = useState<PublishStatus>('idle')
  const [msg, setMsg] = useState('')
  const [showModal, setShowModal] = useState(false)

  const publish = async () => {
    setShowModal(false)
    setStatus('publishing')
    setMsg('GitHub Action wird gestartet…')

    try {
      const res = await fetch('/api/publish?target=projects', { method: 'POST' })
      const data = await res.json()

      if (data.ok) {
        setStatus('success')
        setMsg(data.message)
        toast.success('Publish gestartet', { detail: 'Live in ~1-2 Minuten auf yusefbach.de' })
        log({ action: 'publish_triggered', status: 'success', message: 'Projects Publish-Action gestartet' })
      } else {
        const errMsg = data.message || data.error || 'Unbekannter Fehler'
        setStatus('error')
        setMsg(errMsg)
        toast.error('Publish fehlgeschlagen', { detail: errMsg })
        log({ action: 'publish_failed', status: 'error', message: 'Publish-Action konnte nicht gestartet werden', error: errMsg })
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Netzwerkfehler'
      setStatus('error')
      setMsg(errMsg)
      toast.error('Netzwerkfehler', { detail: errMsg })
      log({ action: 'publish_failed', status: 'error', error: errMsg })
    }

    setTimeout(() => { setStatus('idle'); setMsg('') }, 8000)
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => setShowModal(true)}
          disabled={status === 'publishing'}
          className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium disabled:opacity-50 transition-colors"
        >
          {status === 'publishing' ? '⏳ Publish läuft…' : '🚀 Publish'}
        </button>
        {msg && (
          <span className={`text-xs ${status === 'error' ? 'text-red-400' : status === 'success' ? 'text-green-400' : 'text-blue-400'}`}>
            {msg}
          </span>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-2">🚀 Projects publishen?</h3>
            <p className="text-gray-400 text-sm mb-6">
              GitHub Actions wird gestartet und erzeugt <code className="text-purple-400">js/projects-data.js</code> aus Supabase. Die Änderungen sind in ~1–2 Minuten auf yusefbach.de live.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
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
    </>
  )
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter()
  const toast = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ─── Laden ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      toast.error('Laden fehlgeschlagen', { detail: error.message })
    } else {
      setProjects(data ?? [])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = projects.findIndex(p => p.id === active.id)
    const newIndex = projects.findIndex(p => p.id === over.id)
    const reordered = arrayMove(projects, oldIndex, newIndex)

    // Optimistisch updaten
    setProjects(reordered)

    // sort_order in DB persistieren
    const updates = reordered.map((p, i) => ({ id: p.id, sort_order: i }))
    const errors: string[] = []

    for (const u of updates) {
      const { error } = await supabase
        .from('projects')
        .update({ sort_order: u.sort_order, updated_at: new Date().toISOString() })
        .eq('id', u.id)
      if (error) errors.push(error.message)
    }

    if (errors.length > 0) {
      toast.error('Reihenfolge teilweise nicht gespeichert', { detail: errors[0] })
      log({ action: 'projects_reorder_failed', status: 'error', error: errors.join('; ') })
      await load() // Neu laden bei Fehler
    } else {
      log({ action: 'projects_reordered', status: 'success', message: 'Reihenfolge aktualisiert' })
    }
  }

  // ─── Hero setzen ──────────────────────────────────────────────────────────

  const handleSetHero = async (id: string) => {
    const prevHero = projects.find(p => p.is_hero)

    // Optimistisch
    setProjects(prev => prev.map(p => ({ ...p, is_hero: p.id === id })))

    // Altes Hero auf false
    if (prevHero) {
      await supabase
        .from('projects')
        .update({ is_hero: false, updated_at: new Date().toISOString() })
        .eq('id', prevHero.id)
    }

    // Neues Hero auf true
    const { error } = await supabase
      .from('projects')
      .update({ is_hero: true, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      toast.error('Hero konnte nicht gesetzt werden', { detail: error.message })
      log({ action: 'project_hero_failed', status: 'error', error: error.message })
      await load()
    } else {
      const p = projects.find(p => p.id === id)
      toast.success(`"${p?.title}" ist jetzt Hero`)
      log({ action: 'project_hero_set', status: 'success', message: `Hero → ${p?.title}`, details: { id } })
    }
  }

  // ─── Löschen ──────────────────────────────────────────────────────────────

  const confirmDelete = (id: string, title: string) => setDeleteTarget({ id, title })

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', deleteTarget.id)

    setDeleting(false)
    setDeleteTarget(null)

    if (error) {
      toast.error('Löschen fehlgeschlagen', { detail: error.message })
      log({ action: 'project_delete_failed', status: 'error', error: error.message, details: { id: deleteTarget.id } })
    } else {
      toast.success(`"${deleteTarget.title}" gelöscht`)
      log({ action: 'project_deleted', status: 'success', message: `Projekt gelöscht: ${deleteTarget.title}`, details: { id: deleteTarget.id } })
      setProjects(prev => prev.filter(p => p.id !== deleteTarget.id))
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Projects</h2>
          <p className="text-gray-400 text-sm mt-1">
            {projects.length} Projekte · Drag zum Umsortieren · ⭐ = Hero auf index.html
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard/projects/new')}
            className="px-3 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            + Neues Projekt
          </button>
          <PublishButton />
        </div>
      </div>

      {/* Projekt-Liste */}
      {loading ? (
        <div className="text-gray-500 text-sm py-8 text-center">Lädt…</div>
      ) : projects.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
          Noch keine Projekte. Migrations-Script ausführen oder neues Projekt anlegen.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {projects.map(project => (
                <SortableProjectRow
                  key={project.id}
                  project={project}
                  onSetHero={handleSetHero}
                  onDelete={confirmDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* GitHub-Karte Panel */}
      <GithubCardPanel />

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-2">🗑 Projekt löschen?</h3>
            <p className="text-gray-400 text-sm mb-6">
              <strong className="text-white">{deleteTarget.title}</strong> wird unwiderruflich gelöscht.
              Das Bild in Supabase Storage bleibt erhalten und muss ggf. manuell entfernt werden.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-700 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? '⏳ Löscht…' : 'Ja, löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
