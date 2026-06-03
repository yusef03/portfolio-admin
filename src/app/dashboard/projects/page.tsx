'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useToast } from '@/components/Toast'
import { PageHeader, Button, Card, Badge, Modal, Input, PageTransition } from '@/components/ui'
import { Plus, Rocket, GripVertical, Star, Pencil, Trash2, Loader2, FolderKanban } from 'lucide-react'
import type { Project, GithubCard } from '@/lib/types'

async function log(payload: { action: string; status: 'success'|'warning'|'error'|'info'; message?: string; details?: Record<string,unknown>; error?: string }) {
  try { await fetch('/api/activity', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...payload, category:'projects'}) }) } catch { /**/ }
}

const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const STATUS_LABELS: Record<string, string> = { 'active':'Active', 'in-progress':'In Progress', 'completed':'Completed' }
const STATUS_VARIANT: Record<string, 'success'|'brand'|'default'> = { 'active':'success', 'in-progress':'brand', 'completed':'default' }

// ─── Sortable Project Card ─────────────────────────────────────────────────────

function SortableProjectCard({ project, onSetHero, onDelete }: { project: Project; onSetHero:(id:string)=>void; onDelete:(id:string,title:string)=>void }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'var(--color-surface-1)',
        borderColor: project.is_hero ? 'rgba(245,158,11,.35)' : 'var(--color-border)',
        boxShadow: project.is_hero ? '0 0 20px rgba(245,158,11,.08)' : undefined,
      }}
      className="group rounded-[var(--radius-lg)] border transition-all duration-200 hover:shadow-[var(--glow-brand)] hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3 p-3">
        {/* Drag Handle */}
        <button {...attributes} {...listeners}
          className="text-[var(--color-border-strong)] hover:text-[var(--color-text-3)] cursor-grab active:cursor-grabbing shrink-0 touch-none p-1"
        >
          <GripVertical size={16} strokeWidth={1.75} />
        </button>

        {/* Image */}
        <div className="w-12 h-12 rounded-[var(--radius-md)] overflow-hidden shrink-0 bg-[var(--color-surface-2)] flex items-center justify-center">
          {project.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.image_url} alt={project.title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
          ) : (
            <FolderKanban size={18} strokeWidth={1.5} className="text-[var(--color-text-3)]" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-[var(--color-text-1)] truncate">{project.title}</span>
            {project.is_hero && <Badge variant="warning">⭐ Hero</Badge>}
            <Badge variant={STATUS_VARIANT[project.status] ?? 'default'}>{STATUS_LABELS[project.status] ?? project.status}</Badge>
          </div>
          <code className="text-[10px] text-[var(--color-text-3)] font-mono mt-0.5 block">{project.slug}</code>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {!project.is_hero && (
            <button onClick={() => onSetHero(project.id)} title="Als Hero setzen"
              className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--color-text-3)] hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
            >
              <Star size={14} strokeWidth={1.75} />
            </button>
          )}
          <button onClick={() => router.push(`/dashboard/projects/${project.id}`)} title="Bearbeiten"
            className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <Pencil size={14} strokeWidth={1.75} />
          </button>
          <button onClick={() => onDelete(project.id, project.title)} title="Löschen"
            className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── GitHub Card Panel ─────────────────────────────────────────────────────────

function GithubCardPanel() {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [card, setCard] = useState<GithubCard>({
    title_de:'Mehr auf GitHub', title_en:'More on GitHub', title_ar:'المزيد على GitHub',
    text_de:'Schau dir meine aktuellen Repositories, Experimente und Code-Snippets an.',
    text_en:'Check out my latest repositories, experiments and code snippets.',
    text_ar:'تصفح مستودعاتي الحديثة وتجاربي البرمجية.',
    btn_de:'Zum Profil', btn_en:'To Profile', btn_ar:'إلى الملف الشخصي',
    url:'https://github.com/yusef03',
  })

  useEffect(() => {
    supabase.from('settings').select('value').eq('key','archive_github_card').single()
      .then(({ data }) => { if (data?.value) setCard(data.value as GithubCard) })
  }, [])

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('settings').upsert({ key:'archive_github_card', value: card, updated_at: new Date().toISOString() }, { onConflict:'key' })
    setSaving(false)
    if (error) { toast.error('Fehler beim Speichern', { detail:error.message }); log({action:'github_card_save_failed',status:'error',error:error.message}) }
    else { toast.success('GitHub-Karte gespeichert'); log({action:'github_card_saved',status:'success',message:'archive_github_card aktualisiert'}) }
  }

  const field = (key: keyof GithubCard, label: string, dir?: 'rtl') => (
    <div>
      <label className="block text-xs text-[var(--color-text-3)] mb-1 font-medium">{label}</label>
      <Input type="text" value={card[key] as string} onChange={e => setCard(prev => ({...prev, [key]: e.target.value}))} dir={dir} />
    </div>
  )

  return (
    <Card className="overflow-hidden p-0">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--color-surface-2)] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-text-1)]">GitHub-Karte (Archiv-Seite)</span>
          <Badge variant="default">DE / EN / AR</Badge>
        </div>
        <span className="text-[var(--color-text-3)] text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-[var(--color-border)] px-5 py-5 space-y-4 bg-[var(--color-surface-0)]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {field('title_de','Titel DE')}{field('title_en','Titel EN')}{field('title_ar','Titel AR','rtl')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {field('text_de','Text DE')}{field('text_en','Text EN')}{field('text_ar','Text AR','rtl')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {field('btn_de','Button DE')}{field('btn_en','Button EN')}{field('btn_ar','Button AR','rtl')}
          </div>
          {field('url','GitHub URL')}
          <div className="flex justify-end">
            <Button variant="primary" size="sm" loading={saving} onClick={save}>Speichern</Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Publish ───────────────────────────────────────────────────────────────────

type PublishStatus = 'idle' | 'publishing' | 'success' | 'error'

function PublishButton() {
  const toast = useToast()
  const [status, setStatus] = useState<PublishStatus>('idle')
  const [msg, setMsg] = useState('')
  const [showModal, setShowModal] = useState(false)

  const publish = async () => {
    setShowModal(false); setStatus('publishing'); setMsg('GitHub Action wird gestartet…')
    try {
      const res = await fetch('/api/publish?target=projects', { method:'POST' }); const data = await res.json()
      if (data.ok) { setStatus('success'); setMsg(data.message); toast.success('Publish gestartet', {detail:'Live in ~1-2 Min'}); log({action:'publish_triggered',status:'success',message:'Projects Publish gestartet'}) }
      else { const m = data.message||data.error||'Fehler'; setStatus('error'); setMsg(m); toast.error('Publish fehlgeschlagen', {detail:m}) }
    } catch (e: unknown) { const m = e instanceof Error ? e.message : 'Netzwerkfehler'; setStatus('error'); setMsg(m); toast.error('Netzwerkfehler', {detail:m}) }
    setTimeout(() => { setStatus('idle'); setMsg('') }, 8000)
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button variant="primary" size="sm" loading={status === 'publishing'} icon={<Rocket size={13} />} onClick={() => setShowModal(true)}>
          Publish
        </Button>
        {msg && <span className={`text-xs ${status==='error'?'text-[var(--color-danger)]':status==='success'?'text-[var(--color-success)]':'text-[var(--color-accent)]'}`}>{msg}</span>}
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Projects publishen?" width="md">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-2)]">GitHub Actions erzeugt <code className="text-[var(--color-accent)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded text-xs">js/projects-data.js</code> aus Supabase. In ~1–2 Minuten live auf yusefbach.de.</p>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>Abbrechen</Button>
            <Button variant="primary" size="sm" icon={<Rocket size={13} />} onClick={publish}>Ja, publishen</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─── Hauptseite ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter()
  const toast = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{id:string;title:string}|null>(null)
  const [deleting, setDeleting] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('projects').select('*').order('sort_order', { ascending: true })
    if (error) toast.error('Laden fehlgeschlagen', { detail: error.message })
    else setProjects(data ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = projects.findIndex(p => p.id === active.id)
    const newIndex = projects.findIndex(p => p.id === over.id)
    const reordered = arrayMove(projects, oldIndex, newIndex)
    setProjects(reordered)
    const updates = reordered.map((p, i) => ({ id: p.id, sort_order: i }))
    const errors: string[] = []
    for (const u of updates) {
      const { error } = await supabase.from('projects').update({ sort_order: u.sort_order, updated_at: new Date().toISOString() }).eq('id', u.id)
      if (error) errors.push(error.message)
    }
    if (errors.length > 0) { toast.error('Reihenfolge teilweise nicht gespeichert', { detail:errors[0] }); await load() }
    else { log({action:'projects_reordered',status:'success',message:'Reihenfolge aktualisiert'}) }
  }

  const handleSetHero = async (id: string) => {
    const prevHero = projects.find(p => p.is_hero)
    setProjects(prev => prev.map(p => ({...p, is_hero: p.id === id})))
    if (prevHero) await supabase.from('projects').update({ is_hero:false, updated_at: new Date().toISOString() }).eq('id', prevHero.id)
    const { error } = await supabase.from('projects').update({ is_hero:true, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error('Hero konnte nicht gesetzt werden', {detail:error.message}); await load() }
    else { const p = projects.find(p => p.id === id); toast.success(`"${p?.title}" ist jetzt Hero`); log({action:'project_hero_set',status:'success',message:`Hero → ${p?.title}`,details:{id}}) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('projects').delete().eq('id', deleteTarget.id)
    setDeleting(false); setDeleteTarget(null)
    if (error) { toast.error('Löschen fehlgeschlagen', {detail:error.message}); log({action:'project_delete_failed',status:'error',error:error.message,details:{id:deleteTarget.id}}) }
    else { toast.success(`"${deleteTarget.title}" gelöscht`); log({action:'project_deleted',status:'success',message:`Projekt gelöscht: ${deleteTarget.title}`,details:{id:deleteTarget.id}}); setProjects(prev => prev.filter(p => p.id !== deleteTarget.id)) }
  }

  const heroProject = projects.find(p => p.is_hero)

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} Projekte · Drag zum Umsortieren · ⭐ Hero erscheint als Showcase auf index.html`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => router.push('/dashboard/projects/new')}>
              Neues Projekt
            </Button>
            <PublishButton />
          </div>
        }
      />

      {/* Hero Highlight */}
      {heroProject && (
        <div className="rounded-[var(--radius-lg)] border px-4 py-3 flex items-center gap-3"
          style={{ borderColor:'rgba(245,158,11,.3)', background:'rgba(245,158,11,.06)' }}>
          <Star size={14} strokeWidth={2} className="text-yellow-400 shrink-0" />
          <span className="text-sm text-[var(--color-text-2)]">
            Hero-Projekt: <strong className="text-[var(--color-text-1)]">{heroProject.title}</strong>
            <span className="text-[var(--color-text-3)] ml-2 text-xs">— wird als Showcase auf index.html angezeigt</span>
          </span>
        </div>
      )}

      {/* Project List */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-3)]">
          <Loader2 size={18} className="animate-spin" /> <span className="text-sm">Lädt Projekte…</span>
        </div>
      ) : projects.length === 0 ? (
        <Card className="py-16 text-center">
          <FolderKanban size={32} strokeWidth={1} className="text-[var(--color-text-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-3)]">Noch keine Projekte. Neues Projekt anlegen oder Migrations-Script ausführen.</p>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {projects.map(project => (
                <SortableProjectCard key={project.id} project={project} onSetHero={handleSetHero} onDelete={(id,title) => setDeleteTarget({id,title})} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* GitHub Card */}
      <GithubCardPanel />

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Projekt löschen?" width="sm">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-2)]">
            <strong className="text-[var(--color-text-1)]">{deleteTarget?.title}</strong> wird unwiderruflich gelöscht.
          </p>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" size="sm" disabled={deleting} onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
            <Button variant="danger" size="sm" loading={deleting} icon={<Trash2 size={13} />} onClick={handleDelete}>Ja, löschen</Button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  )
}
