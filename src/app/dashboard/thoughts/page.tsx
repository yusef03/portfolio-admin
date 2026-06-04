'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/Toast'
import {
  ArrowLeft, Save, Rocket, Loader2, Clock, X, Upload, ImageIcon as ImageIco,
  Bold, Italic, Heading2, Heading3, Quote, List, Code2, Link2, Globe, Check, Eye,
} from 'lucide-react'
import type { ThoughtPost } from '@/lib/types'

// ─── Activity Log ─────────────────────────────────────────────────────────────

async function log(payload: {
  action: string
  status: 'success' | 'warning' | 'error' | 'info'
  message?: string
  error?: string
}) {
  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, category: 'thoughts' }),
    })
  } catch { /* silent */ }
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Slug Helper ──────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[àáâãåæ]/g, 'a').replace(/[çč]/g, 'c').replace(/[èéêëě]/g, 'e')
    .replace(/[ìíîïı]/g, 'i').replace(/[ñ]/g, 'n').replace(/[òóôõøő]/g, 'o')
    .replace(/[ùúûűü]/g, 'u').replace(/[ý]/g, 'y')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── Textarea Cursor-Insertion ────────────────────────────────────────────────

function insertAtCursor(el: HTMLTextAreaElement, before: string, after = ''): string {
  const s = el.selectionStart
  const e = el.selectionEnd
  const val = el.value
  const selected = val.slice(s, e)
  const newVal = val.slice(0, s) + before + selected + after + val.slice(e)
  const cursorStart = s + before.length
  const cursorEnd = cursorStart + selected.length
  setTimeout(() => { el.focus(); el.setSelectionRange(cursorStart, cursorEnd) }, 0)
  return newVal
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

async function uploadImage(file: File, postId: string, isInline: boolean): Promise<string | null> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const filename = isInline ? `inline-${Date.now().toString(36)}.${ext}` : `cover.${ext}`
  const path = `thoughts/${postId}/${filename}`
  const { error } = await supabase.storage
    .from('thoughts-media')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) {
    console.error('Upload error:', error)
    return null
  }
  const { data } = supabase.storage.from('thoughts-media').getPublicUrl(path)
  return data.publicUrl
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LangTab = 'en' | 'de' | 'ar'

type ComposerForm = {
  id: string | null
  slug: string

  // Englisch (Pflicht)
  title_en: string
  excerpt_en: string
  content_en: string

  // Deutsch (optional)
  title_de: string
  excerpt_de: string
  content_de: string

  // Arabisch (optional)
  title_ar: string
  excerpt_ar: string
  content_ar: string

  cover_image_url: string | null
  tags: string[]
  status: 'draft' | 'published'
  reading_minutes: number | null
  published_at: string | null
}

function emptyForm(): ComposerForm {
  return {
    id: null, slug: '',
    title_en: '', excerpt_en: '', content_en: '',
    title_de: '', excerpt_de: '', content_de: '',
    title_ar: '', excerpt_ar: '', content_ar: '',
    cover_image_url: null, tags: [],
    status: 'draft', reading_minutes: null, published_at: null,
  }
}

function postToForm(p: ThoughtPost): ComposerForm {
  return {
    id: p.id,
    slug: p.slug,
    title_en: p.title_en ?? '',
    excerpt_en: p.excerpt_en ?? '',
    content_en: p.content_en ?? '',
    title_de: p.title_de ?? '',
    excerpt_de: p.excerpt_de ?? '',
    content_de: p.content_de ?? '',
    title_ar: p.title_ar ?? '',
    excerpt_ar: p.excerpt_ar ?? '',
    content_ar: p.content_ar ?? '',
    cover_image_url: p.cover_image_url,
    tags: p.tags,
    status: p.status,
    reading_minutes: p.reading_minutes,
    published_at: p.published_at,
  }
}

// ─── Composer ─────────────────────────────────────────────────────────────────

const TAB_CONFIG: { id: LangTab; label: string; flag: string; required: boolean }[] = [
  { id: 'en', label: 'EN', flag: '🇬🇧', required: true },
  { id: 'de', label: 'DE', flag: '🇩🇪', required: false },
  { id: 'ar', label: 'AR', flag: '🇸🇦', required: false },
]

function ThoughtsComposer({
  initialForm,
  existingSlugs,
  onClose,
  onSaved,
}: {
  initialForm: ComposerForm
  existingSlugs: string[]
  onClose: () => void
  onSaved: (post: ThoughtPost) => void
}) {
  const toast = useToast()

  const [form, setForm] = useState<ComposerForm>(initialForm)
  const [activeTab, setActiveTab] = useState<LangTab>('en')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(initialForm.id !== null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'running' | 'success' | 'failure'>('idle')
  const [tagInput, setTagInput] = useState('')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingInline, setUploadingInline] = useState(false)

  const editorRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formRef = useRef<ComposerForm>(form)

  useEffect(() => { formRef.current = form }, [form])

  const isEverPublished = form.status === 'published' || form.published_at !== null
  const slugLocked = isEverPublished

  const slugTaken = (() => {
    const trimmed = form.slug.trim()
    if (!trimmed) return false
    return existingSlugs.includes(trimmed)
  })()

  // ── Auto-Save ────────────────────────────────────────────────────────────────

  const triggerAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { doSave(formRef.current) }, 2000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function markDirty() {
    setIsDirty(true)
    triggerAutoSave()
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function doSave(f: ComposerForm, overrideStatus?: 'draft' | 'published'): Promise<ThoughtPost | null> {
    setIsSaving(true)

    const slug = f.slug.trim() || `post-${crypto.randomUUID().slice(0, 8)}`

    // Leere optionale Felder → null
    const payload: Record<string, unknown> = {
      slug,
      title_en: f.title_en.trim(),
      excerpt_en: f.excerpt_en.trim() || null,
      content_en: f.content_en,
      title_de: f.title_de.trim() || null,
      excerpt_de: f.excerpt_de.trim() || null,
      content_de: f.content_de.trim() || null,
      title_ar: f.title_ar.trim() || null,
      excerpt_ar: f.excerpt_ar.trim() || null,
      content_ar: f.content_ar.trim() || null,
      cover_image_url: f.cover_image_url,
      tags: f.tags,
      status: overrideStatus ?? f.status,
      reading_minutes: f.reading_minutes,
      published_at: f.published_at,
      updated_at: new Date().toISOString(),
    }

    let result: ThoughtPost | null = null
    let errMsg: string | null = null

    if (f.id === null) {
      const { data, error } = await supabase.from('thoughts').insert(payload).select().single()
      if (error) { errMsg = error.message }
      else {
        result = data as ThoughtPost
        const newId = result.id
        setForm(prev => ({ ...prev, id: newId, slug }))
        formRef.current.id = newId
        formRef.current.slug = slug
      }
    } else {
      const { data, error } = await supabase.from('thoughts').update(payload).eq('id', f.id).select().single()
      if (error) { errMsg = error.message }
      else { result = data as ThoughtPost }
    }

    setIsSaving(false)

    if (errMsg) {
      toast.error(`Speichern fehlgeschlagen: ${errMsg}`)
      await log({ action: 'save', status: 'error', error: errMsg })
      return null
    }

    setSavedAt(new Date())
    setIsDirty(false)
    if (result) onSaved(result)
    return result
  }

  async function ensurePostId(): Promise<string | null> {
    if (formRef.current.id) return formRef.current.id
    const saved = await doSave(formRef.current)
    return saved?.id ?? null
  }

  // ── Publish ──────────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (!formRef.current.title_en.trim()) {
      toast.error('EN-Titel ist Pflicht vor dem Veröffentlichen')
      setActiveTab('en')
      return
    }
    const nowIso = new Date().toISOString()
    const publishedAt = form.published_at ?? nowIso
    const toSave: ComposerForm = { ...formRef.current, status: 'published', published_at: publishedAt }
    const saved = await doSave(toSave, 'published')
    if (!saved) return

    setForm(f => ({ ...f, status: 'published', published_at: publishedAt }))

    setPublishing(true)
    setPublishStatus('running')
    try {
      const res = await fetch('/api/publish?target=thoughts', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        toast.success('GitHub Action gestartet — live in ~2 Min')
        setPublishStatus('success')
        await log({ action: 'publish', status: 'success', message: form.title_en })
      } else {
        toast.error(`Publish fehlgeschlagen: ${data.message}`)
        setPublishStatus('failure')
        await log({ action: 'publish', status: 'error', error: data.message })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
      toast.error(`Fehler: ${msg}`)
      setPublishStatus('failure')
    }
    setPublishing(false)
  }

  // ── Cover Image ──────────────────────────────────────────────────────────────

  async function handleCoverUpload(file: File) {
    const postId = await ensurePostId()
    if (!postId) return
    setUploadingCover(true)
    const url = await uploadImage(file, postId, false)
    setUploadingCover(false)
    if (!url) { toast.error('Cover-Upload fehlgeschlagen — Storage-Policy prüfen'); return }
    setForm(f => ({ ...f, cover_image_url: url }))
    formRef.current.cover_image_url = url
    markDirty()
    toast.success('Cover hochgeladen')
  }

  // ── Inline Image ─────────────────────────────────────────────────────────────

  async function handleInlineImageUpload(file: File) {
    const postId = await ensurePostId()
    if (!postId) return
    const alt = window.prompt('Alt-Text für das Bild (Barrierefreiheit / SEO):') ?? ''
    setUploadingInline(true)
    const url = await uploadImage(file, postId, true)
    setUploadingInline(false)
    if (!url) { toast.error('Bild-Upload fehlgeschlagen — Storage-Policy prüfen'); return }
    if (editorRef.current) {
      const contentKey = `content_${activeTab}` as keyof ComposerForm
      const currentContent = String(form[contentKey] ?? '')
      const newContent = insertAtCursor(editorRef.current, `![${alt}](${url})`)
      const patch = { [contentKey]: newContent } as Partial<ComposerForm>
      setForm(f => ({ ...f, ...patch }))
      ;(formRef.current as Record<string, unknown>)[contentKey] = newContent
      void currentContent // suppress unused warning
      markDirty()
    }
  }

  // ── Paste / Drop ─────────────────────────────────────────────────────────────

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    for (const item of Array.from(e.clipboardData?.items ?? [])) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) await handleInlineImageUpload(file)
        break
      }
    }
  }

  async function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    const file = e.dataTransfer?.files?.[0]
    if (!file?.type.startsWith('image/')) return
    e.preventDefault()
    await handleInlineImageUpload(file)
  }

  // ── Toolbar ──────────────────────────────────────────────────────────────────

  function toolbar(action: string) {
    const el = editorRef.current
    if (!el) return
    const contentKey = `content_${activeTab}` as keyof ComposerForm
    let newContent = String(form[contentKey] ?? '')
    switch (action) {
      case 'bold':   newContent = insertAtCursor(el, '**', '**'); break
      case 'italic': newContent = insertAtCursor(el, '*', '*'); break
      case 'h2':     newContent = insertAtCursor(el, '## '); break
      case 'h3':     newContent = insertAtCursor(el, '### '); break
      case 'quote':  newContent = insertAtCursor(el, '> '); break
      case 'ul':     newContent = insertAtCursor(el, '- '); break
      case 'code':   newContent = insertAtCursor(el, '```\n', '\n```'); break
      case 'link':   newContent = insertAtCursor(el, '[', '](url)'); break
      case 'image': {
        const inp = document.createElement('input')
        inp.type = 'file'; inp.accept = 'image/*'
        inp.onchange = async () => { if (inp.files?.[0]) await handleInlineImageUpload(inp.files[0]) }
        inp.click()
        return
      }
      default: return
    }
    const patch = { [contentKey]: newContent } as Partial<ComposerForm>
    setForm(f => ({ ...f, ...patch }))
    ;(formRef.current as Record<string, unknown>)[contentKey] = newContent
    markDirty()
  }

  // ── Tags ─────────────────────────────────────────────────────────────────────

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag || form.tags.includes(tag)) { setTagInput(''); return }
    const newTags = [...form.tags, tag]
    setForm(f => ({ ...f, tags: newTags }))
    formRef.current.tags = newTags
    setTagInput('')
    markDirty()
  }

  function removeTag(tag: string) {
    const newTags = form.tags.filter(t => t !== tag)
    setForm(f => ({ ...f, tags: newTags }))
    formRef.current.tags = newTags
    markDirty()
  }

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  // ── Aktiver Tab: aktuelle Felder ─────────────────────────────────────────────

  const titleKey    = `title_${activeTab}`    as keyof ComposerForm
  const excerptKey  = `excerpt_${activeTab}`  as keyof ComposerForm
  const contentKey  = `content_${activeTab}`  as keyof ComposerForm

  function setTabField(key: keyof ComposerForm, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    ;(formRef.current as Record<string, unknown>)[key] = value
    markDirty()
  }

  function ToolBtn({ icon: Ico, action, title }: { icon: typeof Bold; action: string; title: string }) {
    return (
      <button type="button" onClick={() => toolbar(action)} title={title}
        className="w-8 h-8 rounded-[7px] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-2)] transition-colors">
        <Ico size={15} strokeWidth={1.9} />
      </button>
    )
  }

  // ── Sprach-Badges für Listeneintrag ──────────────────────────────────────────

  function tabHasContent(tab: LangTab): boolean {
    return String(form[`title_${tab}` as keyof ComposerForm] ?? '').trim().length > 0
  }

  const activeContent = String(form[contentKey] ?? '')
  const words = activeContent.trim() ? activeContent.trim().split(/\s+/).filter(Boolean).length : 0
  const readMin = Math.max(1, Math.round(words / 200))
  const previewTitle = String(form[titleKey] ?? '') || (activeTab !== 'en' ? form.title_en : '')
  const previewDate = form.published_at ? new Date(form.published_at) : new Date()
  const fmtPreviewDate = previewDate.toLocaleDateString(activeTab === 'de' ? 'de-DE' : activeTab === 'ar' ? 'ar' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 6.5rem)' }}>

      {/* ══ Action Bar ══════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose}
            className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 border transition-colors hover:bg-[var(--color-surface-2)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}>
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[var(--color-text-1)] truncate">
              {form.title_en || form.title_de || (form.id ? 'Beitrag' : 'Neuer Beitrag')}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] mt-0.5 whitespace-nowrap overflow-hidden">
              {isSaving ? <span className="flex items-center gap-1 text-[var(--color-text-3)]"><Loader2 size={10} className="animate-spin" />Speichert…</span>
                : isDirty ? <span className="flex items-center gap-1 text-[var(--color-warning)]"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" />Ungespeichert</span>
                : savedAt ? <span className="flex items-center gap-1 text-[var(--color-success)]"><Check size={11} />Gespeichert</span>
                : <span className="text-[var(--color-text-3)]">Entwurf</span>}
              <span className="text-[var(--color-border-strong)]">·</span>
              <span className="flex items-center gap-1 text-[var(--color-text-3)]"><Clock size={10} />{readMin} Min<span className="hidden sm:inline"> · {words} Wörter</span></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => doSave(form)} disabled={isSaving} title="Entwurf speichern"
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-[10px] text-[13px] font-medium transition-all disabled:opacity-50 border"
            style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}>
            <Save size={14} /><span className="hidden sm:inline">Entwurf</span>
          </button>
          <button onClick={handlePublish} disabled={publishing || isSaving || !form.title_en.trim()} title="Veröffentlichen"
            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-[10px] text-[13px] font-semibold text-white transition-all disabled:opacity-50 hover:scale-[1.02]"
            style={{ background: publishStatus === 'success' ? 'var(--color-success)' : publishStatus === 'failure' ? 'var(--color-danger)' : 'var(--color-brand)' }}>
            {publishing ? <Loader2 size={14} className="animate-spin" /> : publishStatus === 'success' ? <Check size={14} /> : <Rocket size={14} />}
            <span className="hidden sm:inline">{publishing ? 'Publiziere…' : publishStatus === 'success' ? 'Gestartet' : 'Veröffentlichen'}</span>
          </button>
        </div>
      </div>

      {/* ══ Two Panes ═══════════════════════════════════════════════════════ */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4">

        {/* ── LEFT: Editor ─────────────────────────────────────────────── */}
        <div className="min-h-0 flex flex-col gap-3 overflow-y-auto pr-1 -mr-1">

          {/* Meta: Cover */}
          {form.cover_image_url ? (
            <div className="relative rounded-[14px] overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.cover_image_url} alt="Cover" className="w-full h-28 object-cover" />
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <label className="px-2.5 py-1 rounded-[8px] text-[11px] font-medium cursor-pointer text-white" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
                  Ersetzen
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f) }} />
                </label>
                <button onClick={() => { setForm(f => ({ ...f, cover_image_url: null })); formRef.current.cover_image_url = null; markDirty() }}
                  className="w-7 h-7 rounded-[8px] flex items-center justify-center text-white" style={{ background: 'rgba(255,69,58,0.85)', backdropFilter: 'blur(8px)' }}><X size={13} /></button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1.5 h-24 border border-dashed rounded-[14px] cursor-pointer transition-all text-xs"
              style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text-3)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.color = 'var(--color-brand)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.color = 'var(--color-text-3)' }}>
              {uploadingCover ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              <span>{uploadingCover ? 'Lädt hoch…' : 'Titelbild hochladen (16:9)'}</span>
              <input type="file" accept="image/*" className="hidden" disabled={uploadingCover} onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f) }} />
            </label>
          )}

          {/* Meta: Slug + Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Slug */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-3)] mb-1.5">URL-Slug</label>
              <div className="flex items-center rounded-[10px] border overflow-hidden" style={{ borderColor: slugTaken ? 'var(--color-danger)' : 'var(--color-border-strong)', background: 'var(--color-surface-2)' }}>
                <span className="pl-2.5 pr-1 text-[11px] font-mono text-[var(--color-text-3)] shrink-0">/thoughts/</span>
                <input type="text" value={form.slug} readOnly={slugLocked}
                  onChange={e => { const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); setSlugManuallyEdited(true); setForm(f => ({ ...f, slug })); formRef.current.slug = slug; markDirty() }}
                  placeholder="auto-aus-titel"
                  className={`flex-1 bg-transparent py-2 pr-2 text-[12px] font-mono text-[var(--color-text-1)] outline-none min-w-0 ${slugLocked ? 'opacity-60 cursor-not-allowed' : ''}`} />
              </div>
              {slugTaken && <p className="text-[var(--color-danger)] text-[10px] mt-1">Slug bereits vergeben</p>}
              {slugLocked && <p className="text-[var(--color-warning)] text-[10px] mt-1">Gesperrt nach Veröffentlichung</p>}
            </div>
            {/* Tags */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-3)] mb-1.5">Tags</label>
              <div className="flex flex-wrap items-center gap-1.5 rounded-[10px] border px-2 py-1.5 min-h-[38px]" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border-strong)' }}>
                {form.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-[6px] font-medium" style={{ background: 'rgba(10,132,255,0.12)', color: 'var(--color-brand)' }}>
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="hover:opacity-60"><X size={10} /></button>
                  </span>
                ))}
                <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
                    if (e.key === 'Backspace' && !tagInput && form.tags.length > 0) removeTag(form.tags[form.tags.length - 1])
                  }}
                  placeholder={form.tags.length === 0 ? '#tag + Enter' : '+'}
                  className="flex-1 min-w-[60px] bg-transparent text-[12px] text-[var(--color-text-1)] outline-none placeholder:text-[var(--color-text-3)]" />
              </div>
            </div>
          </div>

          {/* Language tabs */}
          <div className="flex items-center gap-1 p-1 rounded-[10px] border w-fit" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
            {TAB_CONFIG.map(tab => {
              const active = activeTab === tab.id
              const done = tabHasContent(tab.id)
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-xs font-medium transition-all"
                  style={{ background: active ? 'var(--color-surface-1)' : 'transparent', color: active ? 'var(--color-text-1)' : 'var(--color-text-3)', boxShadow: active ? '0 1px 3px rgba(0,0,0,.18)' : 'none' }}>
                  <span>{tab.flag}</span>{tab.label}
                  {tab.required && <span className="text-[var(--color-danger)]">*</span>}
                  {!tab.required && done && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-success)' }} />}
                </button>
              )
            })}
          </div>

          {/* Title */}
          <input type="text" value={String(form[titleKey] ?? '')}
            onChange={e => {
              const val = e.target.value
              setTabField(titleKey, val)
              if (activeTab === 'en' && !slugManuallyEdited && !isEverPublished) { const slug = generateSlug(val); setForm(f => ({ ...f, slug })); formRef.current.slug = slug }
            }}
            placeholder={`Titel ${activeTab === 'en' ? '(Pflicht)' : '(optional)'}…`}
            dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
            className="w-full bg-transparent text-[22px] font-bold tracking-tight text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none border-b pb-2"
            style={{ borderColor: activeTab === 'en' && !form.title_en.trim() ? 'var(--color-danger)' : 'var(--color-border)' }} />

          {/* Toolbar */}
          <div className="flex items-center gap-0.5 flex-wrap rounded-[10px] border p-1" style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}>
            <ToolBtn icon={Bold} action="bold" title="Fett" />
            <ToolBtn icon={Italic} action="italic" title="Kursiv" />
            <span className="w-px h-5 mx-1" style={{ background: 'var(--color-border)' }} />
            <ToolBtn icon={Heading2} action="h2" title="Überschrift 2" />
            <ToolBtn icon={Heading3} action="h3" title="Überschrift 3" />
            <span className="w-px h-5 mx-1" style={{ background: 'var(--color-border)' }} />
            <ToolBtn icon={Quote} action="quote" title="Zitat" />
            <ToolBtn icon={List} action="ul" title="Liste" />
            <ToolBtn icon={Code2} action="code" title="Codeblock" />
            <span className="w-px h-5 mx-1" style={{ background: 'var(--color-border)' }} />
            <ToolBtn icon={Link2} action="link" title="Link" />
            <ToolBtn icon={ImageIco} action="image" title="Bild einfügen" />
            {uploadingInline && <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-3)] ml-2"><Loader2 size={11} className="animate-spin" />Bild…</span>}
          </div>

          {/* Content */}
          <textarea ref={editorRef} value={activeContent}
            onChange={e => setTabField(contentKey, e.target.value)}
            onPaste={handlePaste} onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            placeholder={`Schreibe auf ${activeTab === 'en' ? 'Englisch (Pflicht)' : activeTab === 'de' ? 'Deutsch' : 'Arabisch'}…\n\nBilder per Drag&Drop oder ⌘V einfügen.`}
            dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
            className="flex-1 min-h-[200px] w-full bg-transparent text-[14px] font-mono leading-relaxed text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none resize-none" />

          {/* Excerpt */}
          <div className="border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-3)] mb-1.5">Auszug <span className="font-normal normal-case text-[var(--color-text-3)]">— optional, sonst auto-generiert</span></label>
            <input type="text" value={String(form[excerptKey] ?? '')} onChange={e => setTabField(excerptKey, e.target.value)}
              placeholder={`Kurzer Teaser auf ${activeTab.toUpperCase()}…`} dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
              className="w-full rounded-[10px] border px-3 py-2 text-[13px] text-[var(--color-text-2)] outline-none focus:border-[var(--color-accent)]" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border-strong)' }} />
          </div>
        </div>

        {/* ── RIGHT: Live Article Preview ──────────────────────────────── */}
        <div className="min-h-0 hidden lg:flex flex-col rounded-[16px] border overflow-hidden" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between px-4 h-10 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-1)' }}>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-3)]"><Eye size={12} /> Live-Vorschau</span>
            <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-3)]"><Globe size={11} />{activeTab.toUpperCase()}{activeTab !== 'en' && !String(form[titleKey] ?? '').trim() && <span className="ml-1 text-[var(--color-warning)]">· Fallback EN</span>}</span>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* cover */}
            {form.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.cover_image_url} alt="" className="w-full aspect-[16/9] object-cover" />
            )}
            <article className="px-7 py-6 mx-auto max-w-[640px]" dir={activeTab === 'ar' ? 'rtl' : 'ltr'}>
              {/* tags */}
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {form.tags.map(t => <span key={t} className="text-[11px] font-medium" style={{ color: 'var(--color-brand)' }}>#{t}</span>)}
                </div>
              )}
              {/* title */}
              <h1 className="text-[28px] font-bold tracking-tight leading-[1.15] text-[var(--color-text-1)]">
                {previewTitle || <span className="text-[var(--color-text-3)] italic font-normal">Titel erscheint hier…</span>}
              </h1>
              {/* meta */}
              <div className="flex items-center gap-2.5 mt-4 mb-6 pb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/yb-mark.svg" alt="" className="w-8 h-8 rounded-[8px]" />
                <div>
                  <p className="text-[13px] font-medium text-[var(--color-text-1)] leading-tight">Yusef Bach</p>
                  <p className="text-[11px] text-[var(--color-text-3)]">{fmtPreviewDate} · {readMin} Min Lesezeit</p>
                </div>
              </div>
              {/* body */}
              <div className="text-[15px] leading-[1.7]
                [&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:text-[var(--color-text-1)] [&_h1]:mt-6 [&_h1]:mb-3
                [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:text-[var(--color-text-1)] [&_h2]:mt-6 [&_h2]:mb-2.5
                [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-[var(--color-text-1)] [&_h3]:mt-5 [&_h3]:mb-2
                [&_p]:text-[var(--color-text-2)] [&_p]:mb-4
                [&_ul]:text-[var(--color-text-2)] [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1
                [&_ol]:text-[var(--color-text-2)] [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1
                [&_a]:text-[var(--color-brand)] [&_a]:underline [&_a]:underline-offset-2
                [&_strong]:text-[var(--color-text-1)] [&_strong]:font-semibold
                [&_code]:text-[var(--color-brand)] [&_code]:bg-[var(--color-surface-2)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px]
                [&_pre]:bg-[var(--color-surface-2)] [&_pre]:p-4 [&_pre]:rounded-[12px] [&_pre]:mb-4 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-[var(--color-border)]
                [&_pre_code]:bg-transparent [&_pre_code]:p-0
                [&_blockquote]:border-l-[3px] [&_blockquote]:border-[var(--color-brand)] [&_blockquote]:pl-4 [&_blockquote]:py-0.5 [&_blockquote]:text-[var(--color-text-2)] [&_blockquote]:italic [&_blockquote]:my-4
                [&_img]:rounded-[12px] [&_img]:my-4 [&_img]:w-full
                [&_hr]:border-[var(--color-border)] [&_hr]:my-6">
                {activeContent ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeContent}</ReactMarkdown>
                ) : (
                  <p className="text-[var(--color-text-3)] italic">Dein Beitrag erscheint hier in Echtzeit, während du schreibst…</p>
                )}
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Filter = 'all' | 'draft' | 'published'

export default function ThoughtsPage() {
  const toast = useToast()
  const [posts, setPosts] = useState<ThoughtPost[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [composerForm, setComposerForm] = useState<ComposerForm | null>(null)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('thoughts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Fehler beim Laden der Posts')
    } else {
      setPosts((data ?? []) as ThoughtPost[])
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  async function deletePost(post: ThoughtPost) {
    const displayTitle = post.title_en || post.title_de || 'Entwurf'
    if (!confirm(`Beitrag „${displayTitle}" wirklich löschen?`)) return

    try {
      const { data: files } = await supabase.storage.from('thoughts-media').list(`thoughts/${post.id}`)
      if (files?.length) {
        const paths = files.map(f => `thoughts/${post.id}/${f.name}`)
        await supabase.storage.from('thoughts-media').remove(paths)
      }
    } catch { /* bucket cleanup failure ist nicht kritisch */ }

    const { error } = await supabase.from('thoughts').delete().eq('id', post.id)
    if (error) {
      toast.error(`Fehler: ${error.message}`)
    } else {
      toast.success('Beitrag gelöscht')
      await log({ action: 'delete', status: 'success', message: displayTitle })
      setPosts(ps => ps.filter(p => p.id !== post.id))
    }
  }

  function handleSaved(updated: ThoughtPost) {
    setPosts(ps => {
      const idx = ps.findIndex(p => p.id === updated.id)
      if (idx >= 0) return ps.map(p => p.id === updated.id ? updated : p)
      return [updated, ...ps]
    })
  }

  const editingSlug = composerForm?.slug ?? null
  const existingSlugs = posts.filter(p => p.slug !== editingSlug).map(p => p.slug)
  const filtered = posts.filter(p => filter === 'all' || p.status === filter)

  if (composerForm !== null) {
    return (
      <ThoughtsComposer
        initialForm={composerForm}
        existingSlugs={existingSlugs}
        onClose={() => { setComposerForm(null); loadPosts() }}
        onSaved={handleSaved}
      />
    )
  }

  const draftCount = posts.filter(p => p.status === 'draft').length
  const liveCount = posts.filter(p => p.status === 'published').length

  // Helpers
  const readingTime = (p: ThoughtPost) => p.reading_minutes ?? Math.max(1, Math.round(((p.content_en || '').trim().split(/\s+/).filter(Boolean).length) / 200))
  const excerptOf = (p: ThoughtPost) => {
    const ex = p.excerpt_de || p.excerpt_en
    if (ex) return ex
    const raw = (p.content_de || p.content_en || '').replace(/[#>*`_!\[\]()-]/g, ' ').replace(/\s+/g, ' ').trim()
    return raw.slice(0, 160)
  }
  const langsOf = (p: ThoughtPost) => ['EN', p.title_de ? 'DE' : null, p.title_ar ? 'AR' : null].filter(Boolean) as string[]

  const featured = filtered[0]
  const rest = filtered.slice(1)

  const Cover = ({ post, className }: { post: ThoughtPost; className: string }) => (
    post.cover_image_url
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={post.cover_image_url} alt="" className={`${className} object-cover transition-transform duration-500 group-hover:scale-[1.04]`} />
      : <div className={`${className} flex items-center justify-center`} style={{ background: 'var(--gradient-aurora-soft)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: 'var(--color-text-3)', opacity: .5 }}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
  )

  const StatusBadge = ({ post, overlay }: { post: ThoughtPost; overlay?: boolean }) => (
    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
      style={post.status === 'published'
        ? { color: overlay ? '#fff' : 'var(--color-success)', background: overlay ? 'rgba(48,209,88,0.9)' : 'rgba(48,209,88,.1)', backdropFilter: overlay ? 'blur(8px)' : undefined, border: overlay ? 'none' : '1px solid rgba(48,209,88,.25)' }
        : { color: overlay ? '#fff' : 'var(--color-text-3)', background: overlay ? 'rgba(0,0,0,0.5)' : 'var(--color-surface-2)', backdropFilter: overlay ? 'blur(8px)' : undefined, border: overlay ? 'none' : '1px solid var(--color-border)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: post.status === 'published' ? (overlay ? '#fff' : 'var(--color-success)') : 'currentColor' }} />
      {post.status === 'published' ? 'Live' : 'Entwurf'}
    </span>
  )

  const DeleteBtn = ({ post }: { post: ThoughtPost }) => (
    <button onClick={(e) => { e.stopPropagation(); deletePost(post) }} title="Löschen"
      className="w-8 h-8 rounded-[9px] flex items-center justify-center text-white transition-all hover:scale-105"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,69,58,0.9)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.45)' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
    </button>
  )

  const MetaRow = ({ post }: { post: ThoughtPost }) => (
    <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-3)] flex-wrap">
      <span className="font-mono">{fmtDate(post.published_at ?? post.created_at)}</span>
      <span className="text-[var(--color-border-strong)]">·</span>
      <span className="flex items-center gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{readingTime(post)} Min</span>
      <span className="text-[var(--color-border-strong)]">·</span>
      <span className="flex items-center gap-1">{langsOf(post).map((l, i) => <span key={l} style={{ color: i === 0 ? 'var(--color-success)' : 'var(--color-text-2)', fontWeight: 600 }}>{l}</span>)}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-semibold text-[var(--color-text-1)] tracking-tight">Thoughts</h1>
          <p className="text-[var(--color-text-2)] text-sm mt-1">Dein Blog — ein Beitrag in EN / DE / AR</p>
        </div>
        <button onClick={() => setComposerForm(emptyForm())}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-[10px] transition-all hover:scale-[1.02]"
          style={{ background: 'var(--color-brand)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Neuer Post
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 p-1 rounded-[10px] border w-fit" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
        {([['all', `Alle (${posts.length})`], ['published', `Live (${liveCount})`], ['draft', `Entwürfe (${draftCount})`]] as const).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f as Filter)}
            className="px-3 py-1.5 rounded-[7px] text-xs font-medium transition-all"
            style={{ background: filter === f ? 'var(--color-surface-1)' : 'transparent', color: filter === f ? 'var(--color-text-1)' : 'var(--color-text-3)', boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,.15)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0,1,2,3].map(i => <div key={i} className="aspect-[16/11] rounded-[16px] animate-pulse" style={{ background: 'var(--color-surface-2)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 rounded-[18px] border border-dashed" style={{ borderColor: 'var(--color-border-strong)' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: 'var(--color-text-3)' }}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <p className="text-sm text-[var(--color-text-3)]">{posts.length === 0 ? 'Noch keine Beiträge — schreib deinen ersten Gedanken.' : 'Keine Beiträge in dieser Kategorie.'}</p>
          {posts.length === 0 && (
            <button onClick={() => setComposerForm(emptyForm())} className="mt-1 px-4 py-2 text-sm font-semibold text-white rounded-[10px]" style={{ background: 'var(--color-brand)' }}>Ersten Post schreiben</button>
          )}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div layout className="space-y-6">

            {/* ── Featured ─────────────────────────────────── */}
            {featured && (
              <motion.div key={featured.id} layout
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setComposerForm(postToForm(featured))}
                className={`group relative cursor-pointer rounded-[20px] border overflow-hidden grid grid-cols-1 md:grid-cols-2 transition-all duration-300 hover:-translate-y-1 ${featured.status !== 'published' ? 'opacity-75' : ''}`}
                style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 22px 50px -20px rgba(0,0,0,.55)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-border)' }}>
                <div className="relative overflow-hidden min-h-[200px] md:min-h-[260px]">
                  <Cover post={featured} className="w-full h-full absolute inset-0" />
                  <div className="absolute inset-x-0 top-0 h-20 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)' }} />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold text-white" style={{ background: 'var(--color-brand)' }}>★ Neuester</span>
                    <StatusBadge post={featured} overlay />
                  </div>
                  <div className="absolute top-3 right-3 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"><DeleteBtn post={featured} /></div>
                </div>
                <div className="p-6 flex flex-col justify-center">
                  {featured.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2.5">
                      {featured.tags.slice(0, 4).map(t => <span key={t} className="text-[11px] font-medium" style={{ color: 'var(--color-brand)' }}>#{t}</span>)}
                    </div>
                  )}
                  <h2 className="text-[22px] font-bold tracking-tight leading-[1.2] text-[var(--color-text-1)] line-clamp-3">
                    {featured.title_en || featured.title_de || <span className="italic font-normal text-[var(--color-text-3)]">Kein Titel</span>}
                  </h2>
                  <p className="text-[13px] text-[var(--color-text-3)] mt-2.5 line-clamp-3 leading-relaxed">{excerptOf(featured)}</p>
                  <div className="mt-4"><MetaRow post={featured} /></div>
                </div>
              </motion.div>
            )}

            {/* ── Grid ─────────────────────────────────────── */}
            {rest.length > 0 && (
              <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {rest.map(post => (
                  <motion.div key={post.id} layout
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => setComposerForm(postToForm(post))}
                    className={`group relative cursor-pointer rounded-[16px] border overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1.5 ${post.status !== 'published' ? 'opacity-70' : ''}`}
                    style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 18px 44px -18px rgba(0,0,0,.55)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-border)' }}>
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Cover post={post} className="w-full h-full absolute inset-0" />
                      <div className="absolute inset-x-0 top-0 h-14 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35), transparent)' }} />
                      <div className="absolute top-2.5 left-2.5"><StatusBadge post={post} overlay /></div>
                      <div className="absolute top-2.5 right-2.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"><DeleteBtn post={post} /></div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {post.tags.slice(0, 3).map(t => <span key={t} className="text-[10px] font-medium" style={{ color: 'var(--color-brand)' }}>#{t}</span>)}
                        </div>
                      )}
                      <h3 className="text-[15px] font-semibold leading-snug text-[var(--color-text-1)] line-clamp-2">
                        {post.title_en || post.title_de || <span className="italic font-normal text-[var(--color-text-3)]">Kein Titel</span>}
                      </h3>
                      <p className="text-[12px] text-[var(--color-text-3)] mt-1.5 line-clamp-2 leading-relaxed flex-1">{excerptOf(post)}</p>
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}><MetaRow post={post} /></div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
