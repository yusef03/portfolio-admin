'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/components/Toast'
import { Button, Card, Input, Textarea, Field, LangTabs, Segmented, Switch, PageTransition } from '@/components/ui'
import { ArrowLeft, Save, Upload, X, Trash2, Plus, Loader2, ImageIcon, Star } from 'lucide-react'
import type { Project, ProjectFeature, ProjectStatus } from '@/lib/types'

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, hint, right, children }: { title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-3)]">{title}</h3>
          {hint && <p className="text-[11px] text-[var(--color-text-3)] mt-0.5 normal-case">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  )
}

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// ─── Defaults ─────────────────────────────────────────────────────────────────

function emptyProject(): Omit<Project, 'id' | 'created_at' | 'updated_at'> {
  return {
    slug: '',
    title: '',
    description_de: '',
    description_en: '',
    description_ar: '',
    badges: [],
    features: [],
    status: 'in-progress',
    image_url: '',
    github_url: null,
    demo_url: null,
    subpage_url: null,
    timeframe: null,
    role: null,
    is_hero: false,
    sort_order: 99,
  }
}

type Lang = 'de' | 'en' | 'ar'

// ─── Badge Chip Input ─────────────────────────────────────────────────────────

function BadgeInput({ badges, onChange }: { badges: string[]; onChange: (b: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = () => {
    const val = input.trim()
    if (val && !badges.includes(val)) onChange([...badges, val])
    setInput('')
  }
  return (
    <div className="space-y-3">
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map(b => (
            <span key={b} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs rounded-full font-medium"
              style={{ background: 'rgba(10,132,255,0.1)', color: 'var(--color-brand)', border: '1px solid rgba(10,132,255,0.2)' }}>
              {b}
              <button onClick={() => onChange(badges.filter(x => x !== b))}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[var(--color-danger)]/20 hover:text-[var(--color-danger)] transition-colors" aria-label={`${b} entfernen`}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Badge tippen + Enter…" className="flex-1" />
        <Button variant="secondary" size="md" icon={<Plus size={14} />} onClick={add}>Add</Button>
      </div>
    </div>
  )
}

// ─── Feature List ─────────────────────────────────────────────────────────────

function FeatureList({ features, onChange }: { features: ProjectFeature[]; onChange: (f: ProjectFeature[]) => void }) {
  const update = (index: number, lang: Lang, value: string) => {
    onChange(features.map((f, i) => i === index ? { ...f, [lang]: value } : f))
  }
  return (
    <div className="space-y-2.5">
      {features.map((f, i) => (
        <div key={i} className="flex gap-2.5 items-start rounded-[12px] border p-2.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}>
          <span className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-3)' }}>{i + 1}</span>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input value={f.de} onChange={e => update(i, 'de', e.target.value)} placeholder="DE" className="text-xs" />
            <Input value={f.en} onChange={e => update(i, 'en', e.target.value)} placeholder="EN" className="text-xs" />
            <Input value={f.ar} onChange={e => update(i, 'ar', e.target.value)} placeholder="AR" dir="rtl" className="text-xs" />
          </div>
          <button onClick={() => onChange(features.filter((_, idx) => idx !== i))}
            className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors shrink-0 mt-0.5" aria-label="Feature entfernen">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...features, { de: '', en: '', ar: '' }])}
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-brand)] hover:opacity-70 transition-opacity pt-1">
        <Plus size={13} /> Feature hinzufügen
      </button>
    </div>
  )
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

function ImageUpload({
  projectId,
  imageUrl,
  onChange,
}: {
  projectId: string
  imageUrl: string
  onChange: (url: string) => void
}) {
  const toast = useToast()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    if (!projectId || projectId === 'new') {
      toast.warning('Zuerst Projekt speichern, dann Bild hochladen')
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${projectId}.${ext}`

    const { error } = await supabase.storage
      .from('project-images')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) {
      toast.error('Upload fehlgeschlagen', { detail: error.message })
      log({ action: 'image_upload_failed', status: 'error', error: error.message })
      setUploading(false)
      return
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/project-images/${path}?v=${Date.now()}`
    onChange(publicUrl)
    toast.success('Bild hochgeladen')
    log({ action: 'image_uploaded', status: 'success', details: { projectId, path } })
    setUploading(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-4 items-start">
        <div className="w-24 h-24 rounded-[14px] overflow-hidden shrink-0 flex items-center justify-center border" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Vorschau" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
          ) : (
            <ImageIcon size={26} strokeWidth={1.4} className="text-[var(--color-text-3)]" />
          )}
        </div>
        <div className="flex-1 space-y-2.5">
          <Input value={imageUrl} onChange={e => onChange(e.target.value)} placeholder="https://… oder leer lassen" className="font-mono text-xs" />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" loading={uploading} icon={<Upload size={13} />} onClick={() => inputRef.current?.click()}>
              Hochladen
            </Button>
            {imageUrl && (
              <Button variant="ghost" size="sm" icon={<X size={13} />} onClick={() => onChange('')}>Entfernen</Button>
            )}
          </div>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]) }} />
    </div>
  )
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function ProjectEditorPage() {
  const router = useRouter()
  const params = useParams()
  const toast = useToast()

  const isNew = params.id === 'new'
  const projectId = isNew ? null : (params.id as string)

  const [form, setForm] = useState<Omit<Project, 'id' | 'created_at' | 'updated_at'>>(emptyProject())
  const [originalSlug, setOriginalSlug] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [descLang, setDescLang] = useState<Lang>('de')

  // ─── hasChanges Warnung ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])

  // ─── Laden ───────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error || !data) {
      toast.error('Projekt nicht gefunden', { detail: error?.message })
      router.push('/dashboard/projects')
      return
    }

    const { id: _id, created_at: _ca, updated_at: _ua, ...fields } = data as Project
    setForm(fields)
    setOriginalSlug(data.slug)
    setLoading(false)
  }, [projectId, router, toast])

  useEffect(() => { load() }, [load])

  // ─── Feld ändern ─────────────────────────────────────────────────────────

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  // ─── Speichern ────────────────────────────────────────────────────────────

  const save = async () => {
    if (!form.slug.trim()) { toast.warning('Slug darf nicht leer sein'); return }
    if (!form.title.trim()) { toast.warning('Titel darf nicht leer sein'); return }

    setSaving(true)

    if (isNew) {
      const { data, error } = await supabase
        .from('projects')
        .insert({ ...form, updated_at: new Date().toISOString() })
        .select('id')
        .single()

      if (error) {
        toast.error('Anlegen fehlgeschlagen', { detail: error.message })
        log({ action: 'project_create_failed', status: 'error', error: error.message })
        setSaving(false)
        return
      }

      toast.success(`"${form.title}" angelegt`)
      log({ action: 'project_created', status: 'success', message: `Projekt angelegt: ${form.title}`, details: { id: data.id } })
      setHasChanges(false)
      router.push(`/dashboard/projects/${data.id}`)
    } else {
      const { error } = await supabase
        .from('projects')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', projectId!)

      if (error) {
        toast.error('Speichern fehlgeschlagen', { detail: error.message })
        log({ action: 'project_save_failed', status: 'error', error: error.message, details: { id: projectId } })
        setSaving(false)
        return
      }

      toast.success('Gespeichert')
      log({ action: 'project_saved', status: 'success', message: `Projekt gespeichert: ${form.title}`, details: { id: projectId } })
      setHasChanges(false)
      setOriginalSlug(form.slug)
    }

    setSaving(false)
  }

  const slugChanged = !isNew && form.slug !== originalSlug && originalSlug !== ''

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-3)]">
        <Loader2 size={18} className="animate-spin" /><span className="text-sm">Lädt Projekt…</span>
      </div>
    )
  }

  const goBack = () => {
    if (hasChanges && !window.confirm('Änderungen verwerfen?')) return
    router.push('/dashboard/projects')
  }

  return (
    <PageTransition className="max-w-3xl space-y-5 pb-8">

      {/* Sticky Action Bar */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 backdrop-blur-xl" style={{ background: 'color-mix(in srgb, var(--color-surface-0) 80%, transparent)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={goBack} className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 border transition-colors hover:bg-[var(--color-surface-2)]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}>
              <ArrowLeft size={17} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-1)] truncate">
                {isNew ? 'Neues Projekt' : (form.title || 'Projekt')}
              </h1>
              {hasChanges && <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-warning)] mt-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" />Ungespeicherte Änderungen</span>}
            </div>
          </div>
          <Button variant="primary" size="md" loading={saving} icon={<Save size={14} />} onClick={save}>Speichern</Button>
        </div>
      </div>

      {/* Basis */}
      <Section title="Basis">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Slug" hint="URL-Identifier">
            <Input value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))} className="font-mono" />
            {slugChanged && <p className="text-[var(--color-warning)] text-[11px] mt-1">Slug geändert — Subseite & Links ggf. manuell anpassen.</p>}
          </Field>
          <Field label="Titel" hint="Eigenname, kein i18n">
            <Input value={form.title} onChange={e => set('title', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Beschreibung */}
      <Section title="Beschreibung" right={
        <LangTabs<Lang> value={descLang} onChange={setDescLang}
          langs={[{id:'de',label:'DE',done:!!form.description_de},{id:'en',label:'EN',done:!!form.description_en},{id:'ar',label:'AR',done:!!form.description_ar}]} />
      }>
        <Textarea key={descLang}
          value={descLang === 'de' ? form.description_de : descLang === 'en' ? form.description_en : form.description_ar}
          onChange={e => { if (descLang === 'de') set('description_de', e.target.value); else if (descLang === 'en') set('description_en', e.target.value); else set('description_ar', e.target.value) }}
          rows={4} dir={descLang === 'ar' ? 'rtl' : 'ltr'} placeholder={`Beschreibung auf ${descLang.toUpperCase()}…`} />
      </Section>

      {/* Badges */}
      <Section title="Badges / Tech-Stack">
        <BadgeInput badges={form.badges} onChange={v => set('badges', v)} />
      </Section>

      {/* Features */}
      <Section title="Features" hint="Hero-Bullets — DE / EN / AR je Zeile">
        <FeatureList features={form.features} onChange={v => set('features', v)} />
      </Section>

      {/* Status */}
      <Section title="Status">
        <Segmented<ProjectStatus>
          value={form.status} onChange={(s) => set('status', s)}
          options={[{id:'active',label:'Active'},{id:'in-progress',label:'In Progress'},{id:'completed',label:'Completed'}]}
        />
      </Section>

      {/* Bild */}
      <Section title="Bild">
        <ImageUpload projectId={projectId ?? 'new'} imageUrl={form.image_url} onChange={v => set('image_url', v)} />
      </Section>

      {/* Links */}
      <Section title="Links">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="GitHub-URL"><Input type="url" value={form.github_url ?? ''} onChange={e => set('github_url', e.target.value || null)} placeholder="https://github.com/…" /></Field>
          <Field label="Demo-URL" hint="optional"><Input type="url" value={form.demo_url ?? ''} onChange={e => set('demo_url', e.target.value || null)} placeholder="https://…" /></Field>
          <Field label="Subseiten-URL" hint="optional"><Input value={form.subpage_url ?? ''} onChange={e => set('subpage_url', e.target.value || null)} placeholder="projects/studynexus.html" /></Field>
        </div>
      </Section>

      {/* Meta */}
      <Section title="Meta">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Zeitraum" hint="optional"><Input value={form.timeframe ?? ''} onChange={e => set('timeframe', e.target.value || null)} placeholder="04/2026 — laufend" /></Field>
          <Field label="Rolle" hint="optional"><Input value={form.role ?? ''} onChange={e => set('role', e.target.value || null)} placeholder="Full-Stack Developer" /></Field>
          <Field label="Sortierungs-Index"><Input type="number" value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} /></Field>
        </div>
        <div className="flex items-center justify-between rounded-[12px] border px-4 py-3 mt-1"
          style={{ borderColor: form.is_hero ? 'rgba(255,214,10,.3)' : 'var(--color-border)', background: form.is_hero ? 'rgba(255,214,10,.06)' : 'var(--color-surface-0)' }}>
          <div className="flex items-center gap-2.5">
            <Star size={16} className={form.is_hero ? 'text-yellow-400' : 'text-[var(--color-text-3)]'} fill={form.is_hero ? 'currentColor' : 'none'} />
            <div>
              <p className="text-[13px] font-medium text-[var(--color-text-1)]">Hero-Projekt</p>
              <p className="text-[11px] text-[var(--color-text-3)]">Als Showcase auf der Startseite anzeigen</p>
            </div>
          </div>
          <Switch checked={form.is_hero} onChange={(v) => set('is_hero', v)} variant="brand" />
        </div>
      </Section>

      {/* Footer */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="md" onClick={goBack}>Abbrechen</Button>
        <Button variant="primary" size="md" loading={saving} icon={<Save size={14} />} onClick={save}>Speichern</Button>
      </div>
    </PageTransition>
  )
}
