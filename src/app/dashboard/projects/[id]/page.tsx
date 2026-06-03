'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/components/Toast'
import type { Project, ProjectFeature, ProjectStatus } from '@/lib/types'

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

// ─── Lang Tabs ────────────────────────────────────────────────────────────────

type Lang = 'de' | 'en' | 'ar'

function LangTabs({ active, onChange }: { active: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex border border-[var(--color-border-strong)] rounded-lg overflow-hidden w-fit">
      {(['de', 'en', 'ar'] as Lang[]).map(l => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            active === l ? 'bg-[var(--color-brand)] text-[var(--color-text-1)]' : 'bg-[var(--color-surface-1)] text-[var(--color-text-2)] hover:text-[var(--color-text-1)]'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

// ─── Badge Chip Input ─────────────────────────────────────────────────────────

function BadgeInput({ badges, onChange }: { badges: string[]; onChange: (b: string[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const val = input.trim()
    if (val && !badges.includes(val)) {
      onChange([...badges, val])
    }
    setInput('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {badges.map(b => (
          <span key={b} className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] text-[var(--color-text-2)]">
            {b}
            <button
              onClick={() => onChange(badges.filter(x => x !== b))}
              className="text-[var(--color-text-3)] hover:text-red-400 transition-colors"
              aria-label={`${b} entfernen`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Badge hinzufügen (Enter)"
          className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={add}
          className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-3)] transition-colors"
        >
          +
        </button>
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
    <div className="space-y-2">
      {features.map((f, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="text-[var(--color-text-3)] text-xs pt-2 w-4 shrink-0">{i + 1}.</span>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={f.de}
              onChange={e => update(i, 'de', e.target.value)}
              placeholder="DE"
              className="px-2 py-1.5 text-xs rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <input
              type="text"
              value={f.en}
              onChange={e => update(i, 'en', e.target.value)}
              placeholder="EN"
              className="px-2 py-1.5 text-xs rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <input
              type="text"
              value={f.ar}
              onChange={e => update(i, 'ar', e.target.value)}
              placeholder="AR"
              dir="rtl"
              className="px-2 py-1.5 text-xs rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            onClick={() => onChange(features.filter((_, idx) => idx !== i))}
            className="text-[var(--color-text-3)] hover:text-red-400 transition-colors pt-1.5 shrink-0"
            aria-label="Feature entfernen"
          >
            🗑
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...features, { de: '', en: '', ar: '' }])}
        className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
      >
        + Feature hinzufügen
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
    <div className="space-y-2">
      <div className="flex gap-3 items-start">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Vorschau"
            className="w-20 h-20 rounded-xl object-cover bg-[var(--color-surface-2)] shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
          />
        )}
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={imageUrl}
            onChange={e => onChange(e.target.value)}
            placeholder="https://… oder leer lassen"
            className="w-full px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-3)] transition-colors disabled:opacity-50"
            >
              {uploading ? '⏳ Lädt hoch…' : '📤 Hochladen'}
            </button>
            {imageUrl && (
              <button
                onClick={() => onChange('')}
                className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:text-red-400 transition-colors"
              >
                Entfernen
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]) }}
      />
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
    return <div className="text-[var(--color-text-3)] text-sm py-8 text-center">Lädt…</div>
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-1)] tracking-tight">
            {isNew ? 'Neues Projekt' : `${form.title || 'Projekt'} bearbeiten`}
          </h2>
          {hasChanges && <span className="text-yellow-400 text-xs mt-1 block">● Ungespeicherte Änderungen</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (hasChanges && !window.confirm('Änderungen verwerfen?')) return
              router.push('/dashboard/projects')
            }}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-3)] transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--color-brand)] hover:bg-purple-500 text-[var(--color-text-1)] font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? '⏳ Speichert…' : '💾 Speichern'}
          </button>
        </div>
      </div>

      {/* Slug + Titel */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-medium text-[var(--color-text-2)] uppercase tracking-wider">Basis</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[var(--color-text-2)] mb-1">
              Slug <span className="text-[var(--color-text-3)]">(URL-Identifier)</span>
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={e => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] font-mono focus:outline-none focus:border-purple-500"
            />
            {slugChanged && (
              <p className="text-yellow-400 text-xs mt-1">
                ⚠️ Slug geändert — Subseite ({form.subpage_url}) und Links ggf. manuell anpassen.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-2)] mb-1">
              Titel <span className="text-[var(--color-text-3)]">(Eigenname, kein i18n)</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Beschreibung */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--color-text-2)] uppercase tracking-wider">Beschreibung</h3>
          <LangTabs active={descLang} onChange={setDescLang} />
        </div>
        <textarea
          key={descLang}
          value={descLang === 'de' ? form.description_de : descLang === 'en' ? form.description_en : form.description_ar}
          onChange={e => {
            if (descLang === 'de') set('description_de', e.target.value)
            else if (descLang === 'en') set('description_en', e.target.value)
            else set('description_ar', e.target.value)
          }}
          rows={4}
          dir={descLang === 'ar' ? 'rtl' : 'ltr'}
          placeholder={`Beschreibung auf ${descLang.toUpperCase()}…`}
          className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-y"
        />
      </div>

      {/* Badges */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-[var(--color-text-2)] uppercase tracking-wider">Badges / Tech-Stack</h3>
        <BadgeInput badges={form.badges} onChange={v => set('badges', v)} />
      </div>

      {/* Features */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-2)] uppercase tracking-wider">Features</h3>
          <p className="text-xs text-[var(--color-text-3)] mt-0.5">Hero-Bullets (DE / EN / AR je Zeile)</p>
        </div>
        <FeatureList features={form.features} onChange={v => set('features', v)} />
      </div>

      {/* Status */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-[var(--color-text-2)] uppercase tracking-wider">Status</h3>
        <div className="flex gap-4">
          {(['active', 'in-progress', 'completed'] as ProjectStatus[]).map(s => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value={s}
                checked={form.status === s}
                onChange={() => set('status', s)}
                className="accent-purple-500"
              />
              <span className="text-sm text-[var(--color-text-2)] capitalize">{s}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Bild */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-[var(--color-text-2)] uppercase tracking-wider">Bild</h3>
        <ImageUpload
          projectId={projectId ?? 'new'}
          imageUrl={form.image_url}
          onChange={v => set('image_url', v)}
        />
      </div>

      {/* Links */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-medium text-[var(--color-text-2)] uppercase tracking-wider">Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[var(--color-text-2)] mb-1">GitHub-URL</label>
            <input
              type="url"
              value={form.github_url ?? ''}
              onChange={e => set('github_url', e.target.value || null)}
              placeholder="https://github.com/…"
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-2)] mb-1">Demo-URL <span className="text-[var(--color-text-3)]">(optional, noch nicht gerendert)</span></label>
            <input
              type="url"
              value={form.demo_url ?? ''}
              onChange={e => set('demo_url', e.target.value || null)}
              placeholder="https://…"
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-2)] mb-1">Subseiten-URL <span className="text-[var(--color-text-3)]">(optional)</span></label>
            <input
              type="text"
              value={form.subpage_url ?? ''}
              onChange={e => set('subpage_url', e.target.value || null)}
              placeholder="projects/studynexus.html"
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-medium text-[var(--color-text-2)] uppercase tracking-wider">Meta</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[var(--color-text-2)] mb-1">Zeitraum <span className="text-[var(--color-text-3)]">(optional)</span></label>
            <input
              type="text"
              value={form.timeframe ?? ''}
              onChange={e => set('timeframe', e.target.value || null)}
              placeholder="04/2026 — laufend"
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-2)] mb-1">Rolle <span className="text-[var(--color-text-3)]">(optional)</span></label>
            <input
              type="text"
              value={form.role ?? ''}
              onChange={e => set('role', e.target.value || null)}
              placeholder="Full-Stack Developer"
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-2)] mb-1">Sortierungs-Index</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={e => set('sort_order', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border-strong)] text-[var(--color-text-1)] focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_hero}
            onChange={e => set('is_hero', e.target.checked)}
            className="accent-yellow-400"
          />
          <span className="text-sm text-[var(--color-text-2)]">Als Hero-Projekt auf der Startseite anzeigen ⭐</span>
        </label>
        {form.is_hero && (
          <p className="text-yellow-400 text-xs">
            ⚠️ Nur ein Projekt kann gleichzeitig Hero sein. Beim Speichern wird das bisherige Hero automatisch deaktiviert, wenn du &quot;Als Hero setzen&quot; auf der Listenseite nutzt. Hier direkt ändern: auf eigene Verantwortung.
          </p>
        )}
      </div>

      {/* Footer Speichern */}
      <div className="flex justify-end gap-2 pb-8">
        <button
          onClick={() => {
            if (hasChanges && !window.confirm('Änderungen verwerfen?')) return
            router.push('/dashboard/projects')
          }}
          className="px-4 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-3)] transition-colors"
        >
          Abbrechen
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-[var(--color-brand)] hover:bg-purple-500 text-[var(--color-text-1)] font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? '⏳ Speichert…' : '💾 Speichern'}
        </button>
      </div>
    </div>
  )
}
