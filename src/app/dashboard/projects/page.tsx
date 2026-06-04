'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
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

function GlassBtn({ onClick, title, children, danger, gold }: { onClick: () => void; title: string; children: React.ReactNode; danger?: boolean; gold?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 rounded-[9px] flex items-center justify-center transition-all duration-150 hover:scale-105"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: '#fff' }}
      onMouseEnter={e => { e.currentTarget.style.background = gold ? 'rgba(255,214,10,0.9)' : danger ? 'rgba(255,69,58,0.9)' : 'rgba(10,132,255,0.9)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.45)' }}
    >
      {children}
    </button>
  )
}

function SortableProjectCard({ project, onSetHero, onDelete }: { project: Project; onSetHero:(id:string)=>void; onDelete:(id:string,title:string)=>void }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 50 : undefined }
  const initial = (project.title || '?').charAt(0).toUpperCase()

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div
        className="relative overflow-hidden rounded-[18px] border transition-all duration-300 hover:-translate-y-1.5"
        style={{ background: 'var(--color-surface-1)', borderColor: project.is_hero ? 'rgba(255,214,10,.4)' : 'var(--color-border)' }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = project.is_hero ? '0 18px 44px -18px rgba(255,214,10,.25)' : '0 18px 44px -18px rgba(0,0,0,.55)'; if (!project.is_hero) e.currentTarget.style.borderColor = 'var(--color-border-strong)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; if (!project.is_hero) e.currentTarget.style.borderColor = 'var(--color-border)' }}
      >
        {/* Cover */}
        <div className="relative aspect-[16/10] overflow-hidden" style={{ background: 'var(--gradient-aurora-soft)' }}>
          {project.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.image_url} alt={project.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[44px] font-bold tracking-tight" style={{ color: 'var(--color-text-3)', opacity: 0.5 }}>{initial}</span>
            </div>
          )}

          {/* top gradient for legibility */}
          <div className="absolute inset-x-0 top-0 h-20 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)' }} />

          {/* badges top-left */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            {project.is_hero && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(255,214,10,0.95)', color: '#1a1500' }}>
                <Star size={11} fill="currentColor" /> Hero
              </span>
            )}
            <span className="px-2 py-1 rounded-full text-[11px] font-medium"
              style={{
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                color: project.status === 'active' ? '#30D158' : project.status === 'in-progress' ? '#0A84FF' : '#fff',
              }}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
          </div>

          {/* actions top-right (hover) */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
            {!project.is_hero && (
              <GlassBtn gold onClick={() => onSetHero(project.id)} title="Als Hero setzen"><Star size={14} /></GlassBtn>
            )}
            <GlassBtn onClick={() => router.push(`/dashboard/projects/${project.id}`)} title="Bearbeiten"><Pencil size={14} /></GlassBtn>
            <GlassBtn danger onClick={() => onDelete(project.id, project.title)} title="Löschen"><Trash2 size={14} /></GlassBtn>
          </div>

          {/* drag handle bottom-left (hover) */}
          <button {...attributes} {...listeners} title="Ziehen zum Sortieren"
            className="absolute bottom-3 left-3 w-8 h-8 rounded-[9px] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: '#fff' }}>
            <GripVertical size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <h3 className="font-semibold text-[15px] text-[var(--color-text-1)] truncate">{project.title}</h3>
          <code className="text-[11px] text-[var(--color-text-3)] font-mono">{project.slug}</code>
          {project.badges && project.badges.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {project.badges.slice(0, 4).map(b => (
                <span key={b} className="text-[10px] px-1.5 py-0.5 rounded-[6px] font-medium"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-2)' }}>{b}</span>
              ))}
              {project.badges.length > 4 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-[6px] text-[var(--color-text-3)]">+{project.badges.length - 4}</span>
              )}
            </div>
          )}
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

      {/* Hero hint (slim) */}
      {heroProject && (
        <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-3)]">
          <Star size={13} fill="currentColor" className="text-yellow-400 shrink-0" />
          <span>Hero: <strong className="text-[var(--color-text-2)] font-medium">{heroProject.title}</strong> — Showcase auf index.html</span>
        </div>
      )}

      {/* Project Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="aspect-[16/10] rounded-[18px] animate-pulse" style={{ background: 'var(--color-surface-2)' }} />)}
        </div>
      ) : projects.length === 0 ? (
        <Card className="py-16 text-center">
          <FolderKanban size={32} strokeWidth={1} className="text-[var(--color-text-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-3)]">Noch keine Projekte. Neues Projekt anlegen oder Migrations-Script ausführen.</p>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={projects.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects.map(project => (
                <SortableProjectCard key={project.id} project={project} onSetHero={handleSetHero} onDelete={(id,title) => setDeleteTarget({id,title})} />
              ))}
              {/* Add tile */}
              <button onClick={() => router.push('/dashboard/projects/new')}
                className="group flex flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed transition-all duration-200 hover:-translate-y-1 min-h-[180px]"
                style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface-1)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.background = 'var(--color-surface-2)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.background = 'var(--color-surface-1)' }}>
                <div className="w-11 h-11 rounded-[13px] flex items-center justify-center transition-colors" style={{ background: 'var(--color-surface-2)' }}>
                  <Plus size={20} className="text-[var(--color-text-3)] group-hover:text-[var(--color-brand)] transition-colors" />
                </div>
                <span className="text-[13px] font-medium text-[var(--color-text-3)] group-hover:text-[var(--color-text-1)] transition-colors">Neues Projekt</span>
              </button>
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
