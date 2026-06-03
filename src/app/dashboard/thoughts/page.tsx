'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useToast } from '@/components/Toast'
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

  function TBtn({ label, action, title }: { label: string; action: string; title: string }) {
    return (
      <button
        type="button"
        onClick={() => toolbar(action)}
        title={title}
        className="px-2 py-1 text-sm text-[var(--color-text-2)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-3)] rounded transition-colors font-mono"
      >
        {label}
      </button>
    )
  }

  // ── Sprach-Badges für Listeneintrag ──────────────────────────────────────────

  function tabHasContent(tab: LangTab): boolean {
    return String(form[`title_${tab}` as keyof ComposerForm] ?? '').trim().length > 0
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[var(--color-border)] flex-shrink-0">
        <button
          onClick={onClose}
          className="text-[var(--color-text-2)] hover:text-[var(--color-text-1)] text-sm transition-colors flex items-center gap-1"
        >
          ← Alle Posts
        </button>

        <div className="flex-1 min-w-0 text-xs">
          {isSaving && <span className="text-[var(--color-text-3)]">Speichert…</span>}
          {!isSaving && savedAt && !isDirty && <span className="text-green-500">✓ Gespeichert</span>}
          {isDirty && !isSaving && <span className="text-yellow-600">● Ungespeichert</span>}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => doSave(form)}
            disabled={isSaving}
            className="px-3 py-1.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-1)] rounded-lg text-xs transition-colors disabled:opacity-50"
          >
            Entwurf speichern
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || isSaving || !form.title_en.trim()}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
              publishStatus === 'success'
                ? 'bg-green-900/40 text-green-400 border border-green-700'
                : publishStatus === 'failure'
                ? 'bg-red-900/40 text-red-400 border border-red-700'
                : 'bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-[var(--color-text-1)]'
            }`}
          >
            {publishing ? '⟳ Publiziere…' : publishStatus === 'success' ? '✓ Gestartet' : '🚀 Live'}
          </button>
        </div>
      </div>

      {/* ── Slug + Tags ──────────────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-3 flex-shrink-0">
        {/* Slug */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--color-text-3)] flex-shrink-0">Slug:</span>
            <input
              type="text"
              value={form.slug}
              readOnly={slugLocked}
              onChange={e => {
                const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                setSlugManuallyEdited(true)
                setForm(f => ({ ...f, slug }))
                formRef.current.slug = slug
                markDirty()
              }}
              placeholder="url-slug (auto aus EN-Titel)"
              className={`flex-1 bg-[var(--color-surface-1)] border rounded-lg px-2 py-1.5 text-[var(--color-text-2)] text-xs font-mono focus:outline-none min-w-0 ${
                slugLocked
                  ? 'border-[var(--color-border)] cursor-not-allowed opacity-60'
                  : slugTaken
                  ? 'border-red-600 focus:border-red-500'
                  : 'border-[var(--color-border-strong)] focus:border-[var(--color-accent)]'
              }`}
            />
          </div>
          {slugTaken && <p className="text-red-400 text-xs mt-0.5 ml-10">Slug bereits vergeben</p>}
          {slugLocked && (
            <p className="text-yellow-600 text-xs mt-0.5 ml-10">⚠ Gesperrt nach Veröffentlichung</p>
          )}
        </div>

        {/* Tags */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-lg px-2 py-1.5 min-h-[34px] focus-within:border-[var(--color-accent)] transition-colors">
            {form.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 bg-violet-900/40 text-[var(--color-accent)] text-xs px-2 py-0.5 rounded-full border border-violet-700/50">
                {tag}
                <button onClick={() => removeTag(tag)} className="text-[var(--color-accent)] hover:text-[var(--color-text-1)] leading-none">×</button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
                if (e.key === 'Backspace' && !tagInput && form.tags.length > 0) {
                  removeTag(form.tags[form.tags.length - 1])
                }
              }}
              placeholder={form.tags.length === 0 ? 'Tags (Enter oder , zum Hinzufügen — sprachneutral)…' : '+ Tag'}
              className="flex-1 min-w-[100px] bg-transparent text-[var(--color-text-1)] text-xs outline-none placeholder-gray-600"
            />
          </div>
        </div>
      </div>

      {/* ── Cover Image ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex-shrink-0">
        {form.cover_image_url ? (
          <div className="flex items-center gap-3">
            <img src={form.cover_image_url} alt="Cover" className="h-16 w-28 object-cover rounded-lg border border-[var(--color-border-strong)]" />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-[var(--color-text-2)]">Titelbild (sprachneutral)</span>
              <div className="flex gap-3">
                <label className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent)] cursor-pointer transition-colors">
                  Ersetzen
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f) }} />
                </label>
                <button
                  onClick={() => { setForm(f => ({ ...f, cover_image_url: null })); formRef.current.cover_image_url = null; markDirty() }}
                  className="text-xs text-[var(--color-text-3)] hover:text-red-400 transition-colors"
                >Entfernen</button>
              </div>
            </div>
          </div>
        ) : (
          <label className={`flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer transition-colors text-xs w-fit ${
            uploadingCover ? 'border-[var(--color-border-strong)] text-[var(--color-text-3)] cursor-wait' : 'border-[var(--color-border-strong)] text-[var(--color-text-3)] hover:border-[var(--color-brand)] hover:text-[var(--color-accent)]'
          }`}>
            {uploadingCover ? '⟳ Lade hoch…' : '🖼 Titelbild hochladen (16:9 empfohlen — sprachneutral)'}
            <input type="file" accept="image/*" className="hidden" disabled={uploadingCover} onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f) }} />
          </label>
        )}
      </div>

      {/* ── Sprach-Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-3 flex-shrink-0 border-b border-[var(--color-border)] pb-0">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[var(--color-accent)] text-[var(--color-text-1)] bg-[var(--color-surface-1)]'
                : 'border-transparent text-[var(--color-text-3)] hover:text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)]/50'
            }`}
          >
            <span>{tab.flag}</span>
            <span>{tab.label}</span>
            {tab.required && <span className="text-red-400 text-xs">*</span>}
            {!tab.required && tabHasContent(tab.id) && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            )}
            {!tab.required && !tabHasContent(tab.id) && (
              <span className="text-[var(--color-text-3)] text-xs">optional</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Titel (aktueller Tab) ─────────────────────────────────────────────── */}
      <div className="mb-3 flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={String(form[titleKey] ?? '')}
          onChange={e => {
            const val = e.target.value
            setTabField(titleKey, val)
            // Slug auto-generieren aus EN-Titel (solange nicht manuell bearbeitet und nicht published)
            if (activeTab === 'en' && !slugManuallyEdited && !isEverPublished) {
              const slug = generateSlug(val)
              setForm(f => ({ ...f, slug }))
              formRef.current.slug = slug
            }
          }}
          placeholder={`Titel ${activeTab === 'en' ? '(Pflicht)' : '(optional)'}…`}
          className={`flex-1 bg-[var(--color-surface-1)] border rounded-lg px-3 py-2.5 text-[var(--color-text-1)] text-base font-semibold placeholder-gray-600 focus:outline-none focus:border-[var(--color-accent)] ${
            activeTab === 'en' && !form.title_en.trim() ? 'border-red-800' : 'border-[var(--color-border-strong)]'
          }`}
        />
        <div className={`flex items-center px-3 rounded-lg text-xs font-medium border flex-shrink-0 ${
          form.status === 'published'
            ? 'bg-green-900/20 text-green-400 border-green-800'
            : 'bg-[var(--color-surface-2)]/50 text-[var(--color-text-3)] border-[var(--color-border-strong)]'
        }`}>
          {form.status === 'published' ? '● Live' : '○ Entwurf'}
        </div>
      </div>

      {/* ── Editor + Preview ─────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* Editor */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-0.5 px-1 py-1 bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-t-lg border-b-0 flex-shrink-0">
            <TBtn label="B" action="bold" title="Fett (**text**)" />
            <TBtn label="I" action="italic" title="Kursiv (*text*)" />
            <span className="w-px h-5 bg-[var(--color-surface-3)] mx-1 self-center" />
            <TBtn label="H2" action="h2" title="Überschrift 2" />
            <TBtn label="H3" action="h3" title="Überschrift 3" />
            <span className="w-px h-5 bg-[var(--color-surface-3)] mx-1 self-center" />
            <TBtn label="&ldquo;" action="quote" title="Blockquote" />
            <TBtn label="&bull;" action="ul" title="Aufzählung" />
            <TBtn label="&lt;&gt;" action="code" title="Codeblock" />
            <span className="w-px h-5 bg-[var(--color-surface-3)] mx-1 self-center" />
            <TBtn label="🔗" action="link" title="Link [Text](url)" />
            <TBtn label="🖼" action="image" title="Bild einfügen" />
            {uploadingInline && <span className="text-xs text-[var(--color-text-3)] self-center ml-2">⟳ Lade Bild…</span>}
          </div>
          <textarea
            ref={editorRef}
            value={String(form[contentKey] ?? '')}
            onChange={e => setTabField(contentKey, e.target.value)}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            placeholder={`Inhalt auf ${activeTab === 'en' ? 'Englisch (Pflicht)' : activeTab === 'de' ? 'Deutsch (optional)' : 'Arabisch (optional)'}…\n\nTipp: Bilder per Drag&Drop oder Ctrl+V einfügen.`}
            dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
            className="flex-1 w-full bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-b-lg px-4 py-3 text-[var(--color-text-1)] text-sm font-mono resize-none focus:outline-none focus:border-[var(--color-accent)] leading-relaxed"
          />
        </div>

        {/* Preview */}
        <div className="flex flex-col flex-1 min-w-0">
          <p className="text-xs text-[var(--color-text-3)] mb-1.5 px-1 font-medium uppercase tracking-widest flex-shrink-0">
            Vorschau ({activeTab.toUpperCase()})
          </p>
          <div
            dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
            className="flex-1 bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-lg px-5 py-4 overflow-auto text-sm
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-[var(--color-text-1)] [&_h1]:mt-4 [&_h1]:mb-2
              [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[var(--color-text-1)] [&_h2]:mt-4 [&_h2]:mb-2
              [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[var(--color-text-1)] [&_h3]:mt-3 [&_h3]:mb-1
              [&_p]:text-[var(--color-text-2)] [&_p]:mb-3 [&_p]:leading-relaxed
              [&_ul]:text-[var(--color-text-2)] [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:list-disc
              [&_ol]:text-[var(--color-text-2)] [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal
              [&_li]:mb-1 [&_li]:text-[var(--color-text-2)]
              [&_a]:text-[var(--color-accent)]
              [&_strong]:text-[var(--color-text-1)] [&_strong]:font-semibold
              [&_em]:italic [&_em]:text-[var(--color-text-2)]
              [&_code]:text-[var(--color-accent)] [&_code]:bg-[var(--color-surface-2)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
              [&_pre]:bg-[var(--color-surface-2)] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:mb-3 [&_pre]:overflow-x-auto
              [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0
              [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-brand)] [&_blockquote]:pl-4 [&_blockquote]:text-[var(--color-text-2)] [&_blockquote]:italic [&_blockquote]:mb-3
              [&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-2
              [&_hr]:border-[var(--color-border-strong)] [&_hr]:my-4
              [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:text-[var(--color-text-2)] [&_th]:pb-2 [&_td]:text-[var(--color-text-2)] [&_td]:py-1"
          >
            {String(form[contentKey] ?? '') ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {String(form[contentKey] ?? '')}
              </ReactMarkdown>
            ) : (
              <p className="text-[var(--color-text-3)] italic">Vorschau erscheint beim Schreiben…</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Excerpt (aktueller Tab) ───────────────────────────────────────────── */}
      <div className="mt-3 flex-shrink-0">
        <input
          type="text"
          value={String(form[excerptKey] ?? '')}
          onChange={e => setTabField(excerptKey, e.target.value)}
          placeholder={`Auszug auf ${activeTab === 'en' ? 'Englisch' : activeTab === 'de' ? 'Deutsch' : 'Arabisch'} (optional — wird beim Build automatisch generiert)`}
          dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
          className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-[var(--color-text-2)] text-sm focus:outline-none focus:border-[var(--color-accent)] placeholder-gray-600"
        />
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

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-0">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-1)] tracking-tight">Thoughts</h1>
          <p className="text-[var(--color-text-2)] text-sm mt-1">Blog-Posts schreiben, bearbeiten, veröffentlichen — ein Post in EN / DE / AR</p>
        </div>
        <button onClick={() => setComposerForm(emptyForm())}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-[var(--radius-md)] transition-all hover:scale-[1.02] hover:shadow-[var(--glow-brand-strong)]"
          style={{ background: 'var(--gradient-aurora)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Neuer Post
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] border border-[var(--color-border)] w-fit"
        style={{ background: 'var(--color-surface-2)' }}>
        {([['all', `Alle (${posts.length})`], ['draft', `Entwürfe (${draftCount})`], ['published', `Live (${liveCount})`]] as const).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f as Filter)}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-all"
            style={{
              background: filter === f ? 'var(--color-surface-1)' : 'transparent',
              color: filter === f ? 'var(--color-text-1)' : 'var(--color-text-3)',
              boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,.15)' : 'none',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Post List */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-3)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <span className="text-sm">Lädt Posts…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)]">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[var(--color-text-3)]" style={{color:'var(--color-text-3)'}}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <p className="text-sm text-[var(--color-text-3)]">
            {posts.length === 0 ? 'Noch keine Posts — klicke „+ Neuer Post" um den ersten zu schreiben.' : 'Keine Posts in dieser Kategorie.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(post => {
            const displayTitle = post.title_en || post.title_de || post.title_ar || ''
            const hasDe = Boolean(post.title_de)
            const hasAr = Boolean(post.title_ar)
            return (
              <div key={post.id}
                style={{ background:'var(--color-surface-1)', borderColor:'var(--color-border)' }}
                className={`group flex items-center gap-3 px-3 py-3 rounded-[var(--radius-lg)] border transition-all duration-150 hover:border-[var(--color-brand)]/30 hover:shadow-[var(--glow-brand)] hover:-translate-y-px ${post.status !== 'published' ? 'opacity-70' : ''}`}
              >
                {/* Cover */}
                <div className="w-14 h-10 rounded-[var(--radius-md)] overflow-hidden shrink-0">
                  {post.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" style={{ background:'var(--gradient-aurora-soft)' }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--color-text-1)] text-sm font-semibold truncate">
                    {displayTitle || <span className="text-[var(--color-text-3)] italic font-normal">Kein Titel</span>}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[var(--color-text-3)] text-[11px] font-mono">{fmtDate(post.published_at ?? post.created_at)}</span>
                    <span className="text-[var(--color-border-strong)]">·</span>
                    <span className="text-[11px] font-semibold" style={{color:'var(--color-success)'}}>EN</span>
                    {hasDe && <span className="text-[11px] font-medium text-[var(--color-text-2)]">DE</span>}
                    {hasAr && <span className="text-[11px] font-medium text-[var(--color-text-2)]">AR</span>}
                    {post.tags.slice(0,3).map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background:'rgba(0,229,255,.08)', color:'var(--color-accent)', border:'1px solid rgba(0,229,255,.2)' }}>
                        {tag}
                      </span>
                    ))}
                    {post.tags.length > 3 && <span className="text-[10px] text-[var(--color-text-3)]">+{post.tags.length-3}</span>}
                  </div>
                </div>

                {/* Status */}
                <span className="text-[11px] px-2 py-0.5 rounded-full border shrink-0 font-medium"
                  style={post.status === 'published'
                    ? { color:'var(--color-success)', background:'rgba(34,197,94,.08)', borderColor:'rgba(34,197,94,.25)' }
                    : { color:'var(--color-text-3)', background:'var(--color-surface-2)', borderColor:'var(--color-border)' }}>
                  {post.status === 'published' ? '● Live' : '○ Entwurf'}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setComposerForm(postToForm(post))} title="Bearbeiten"
                    className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => deletePost(post)} title="Löschen"
                    className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
