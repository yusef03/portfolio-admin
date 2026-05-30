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

// ─── Slug Helper (identische Logik wie build-thoughts.mjs) ───────────────────

function generateSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[àáâãåæ]/g, 'a').replace(/[çč]/g, 'c').replace(/[èéêëě]/g, 'e')
    .replace(/[ìíîïı]/g, 'i').replace(/[ñ]/g, 'n').replace(/[òóôõøő]/g, 'o')
    .replace(/[ùúûűü]/g, 'u').replace(/[ý]/g, 'y')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug
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
  if (error) return null
  const { data } = supabase.storage.from('thoughts-media').getPublicUrl(path)
  return data.publicUrl
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ComposerForm = {
  id: string | null
  title: string
  slug: string
  excerpt: string
  content: string
  cover_image_url: string | null
  tags: string[]
  lang: 'de' | 'en' | 'ar'
  status: 'draft' | 'published'
  reading_minutes: number | null
  published_at: string | null
}

function emptyForm(): ComposerForm {
  return {
    id: null, title: '', slug: '', excerpt: '', content: '',
    cover_image_url: null, tags: [], lang: 'de',
    status: 'draft', reading_minutes: null, published_at: null,
  }
}

function postToForm(p: ThoughtPost): ComposerForm {
  return {
    id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt ?? '',
    content: p.content, cover_image_url: p.cover_image_url,
    tags: p.tags, lang: p.lang, status: p.status,
    reading_minutes: p.reading_minutes, published_at: p.published_at,
  }
}

// ─── Composer ─────────────────────────────────────────────────────────────────

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

  // ── Auto-Save Trigger ────────────────────────────────────────────────────────

  const triggerAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { doSave(formRef.current) }, 2000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function markDirty() {
    setIsDirty(true)
    triggerAutoSave()
  }

  // ── Save (INSERT or UPDATE) ──────────────────────────────────────────────────

  async function doSave(f: ComposerForm, overrideStatus?: 'draft' | 'published'): Promise<ThoughtPost | null> {
    setIsSaving(true)

    const slug = f.slug.trim() || `post-${crypto.randomUUID().slice(0, 8)}`
    const payload: Record<string, unknown> = {
      title: f.title,
      slug,
      excerpt: f.excerpt.trim() || null,
      content: f.content,
      cover_image_url: f.cover_image_url,
      tags: f.tags,
      lang: f.lang,
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
        await log({ action: 'publish', status: 'success', message: form.title })
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
    if (!url) { toast.error('Cover-Upload fehlgeschlagen'); return }
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
    if (!url) { toast.error('Bild-Upload fehlgeschlagen'); return }
    if (editorRef.current) {
      const newContent = insertAtCursor(editorRef.current, `![${alt}](${url})`)
      setForm(f => ({ ...f, content: newContent }))
      formRef.current.content = newContent
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
    let newContent = form.content
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
    setForm(f => ({ ...f, content: newContent }))
    formRef.current.content = newContent
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

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  // ── Render ───────────────────────────────────────────────────────────────────

  function TBtn({ label, action, title }: { label: string; action: string; title: string }) {
    return (
      <button
        type="button"
        onClick={() => toolbar(action)}
        title={title}
        className="px-2 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors font-mono"
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1"
        >
          ← Alle Posts
        </button>

        <div className="flex-1 min-w-0 text-xs">
          {isSaving && <span className="text-gray-500">Speichert…</span>}
          {!isSaving && savedAt && !isDirty && (
            <span className="text-green-500">✓ Gespeichert</span>
          )}
          {isDirty && !isSaving && <span className="text-yellow-600">● Ungespeichert</span>}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Sprache */}
          <select
            value={form.lang}
            onChange={e => {
              setForm(f => ({ ...f, lang: e.target.value as 'de' | 'en' | 'ar' }))
              formRef.current.lang = e.target.value as 'de' | 'en' | 'ar'
              markDirty()
            }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500"
          >
            <option value="de">🇩🇪 DE</option>
            <option value="en">🇬🇧 EN</option>
            <option value="ar">🇸🇦 AR</option>
          </select>

          {/* Entwurf speichern */}
          <button
            onClick={() => doSave(form)}
            disabled={isSaving}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs transition-colors disabled:opacity-50"
          >
            Entwurf speichern
          </button>

          {/* Publish */}
          <button
            onClick={handlePublish}
            disabled={publishing || isSaving || !form.title.trim()}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
              publishStatus === 'success'
                ? 'bg-green-900/40 text-green-400 border border-green-700'
                : publishStatus === 'failure'
                ? 'bg-red-900/40 text-red-400 border border-red-700'
                : 'bg-violet-600 hover:bg-violet-700 text-white'
            }`}
          >
            {publishing ? '⟳ Publiziere…' : publishStatus === 'success' ? '✓ Gestartet' : '🚀 Live'}
          </button>
        </div>
      </div>

      {/* ── Titel + Status ───────────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-3 flex-shrink-0">
        <input
          type="text"
          value={form.title}
          onChange={e => {
            const title = e.target.value
            const slug = (!slugManuallyEdited && !isEverPublished) ? generateSlug(title) : form.slug
            setForm(f => ({ ...f, title, slug }))
            formRef.current.title = title
            formRef.current.slug = slug
            markDirty()
          }}
          placeholder="Titel des Beitrags…"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-base font-semibold placeholder-gray-600 focus:outline-none focus:border-violet-500"
        />
        <div className={`flex items-center px-3 rounded-lg text-xs font-medium border flex-shrink-0 ${
          form.status === 'published'
            ? 'bg-green-900/20 text-green-400 border-green-800'
            : 'bg-gray-800/50 text-gray-500 border-gray-700'
        }`}>
          {form.status === 'published' ? '● Live' : '○ Entwurf'}
        </div>
      </div>

      {/* ── Slug + Tags ──────────────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-3 flex-shrink-0">
        {/* Slug */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 flex-shrink-0">Slug:</span>
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
              placeholder="url-slug"
              className={`flex-1 bg-gray-900 border rounded-lg px-2 py-1.5 text-gray-300 text-xs font-mono focus:outline-none min-w-0 ${
                slugLocked
                  ? 'border-gray-800 cursor-not-allowed opacity-60'
                  : slugTaken
                  ? 'border-red-600 focus:border-red-500'
                  : 'border-gray-700 focus:border-violet-500'
              }`}
            />
          </div>
          {slugTaken && <p className="text-red-400 text-xs mt-0.5 ml-10">Slug bereits vergeben</p>}
          {slugLocked && (
            <p className="text-yellow-600 text-xs mt-0.5 ml-10">⚠ Gesperrt nach Veröffentlichung (Permalink-Stabilität)</p>
          )}
        </div>

        {/* Tags */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 min-h-[34px] focus-within:border-violet-500 transition-colors">
            {form.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 bg-violet-900/40 text-violet-300 text-xs px-2 py-0.5 rounded-full border border-violet-700/50">
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-violet-400 hover:text-white leading-none"
                >×</button>
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
              placeholder={form.tags.length === 0 ? 'Tags: Enter oder Komma zum Hinzufügen…' : '+ Tag'}
              className="flex-1 min-w-[100px] bg-transparent text-white text-xs outline-none placeholder-gray-600"
            />
          </div>
        </div>
      </div>

      {/* ── Cover Image ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex-shrink-0">
        {form.cover_image_url ? (
          <div className="flex items-center gap-3">
            <img
              src={form.cover_image_url}
              alt="Cover"
              className="h-16 w-28 object-cover rounded-lg border border-gray-700"
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-gray-400">Titelbild (Cover)</span>
              <div className="flex gap-3">
                <label className="text-xs text-violet-400 hover:text-violet-300 cursor-pointer transition-colors">
                  Ersetzen
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files?.[0]; if (f) handleCoverUpload(f)
                  }} />
                </label>
                <button
                  onClick={() => {
                    setForm(f => ({ ...f, cover_image_url: null }))
                    formRef.current.cover_image_url = null
                    markDirty()
                  }}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Entfernen
                </button>
              </div>
            </div>
          </div>
        ) : (
          <label className={`flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer transition-colors text-xs w-fit ${
            uploadingCover
              ? 'border-gray-700 text-gray-600 cursor-wait'
              : 'border-gray-700 text-gray-500 hover:border-violet-600 hover:text-violet-400'
          }`}>
            {uploadingCover ? '⟳ Lade hoch…' : '🖼 Titelbild hochladen (16:9 empfohlen — kein Cover = Lila Gradient-Fallback)'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingCover}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f) }}
            />
          </label>
        )}
      </div>

      {/* ── Editor + Preview ─────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* Editor */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-0.5 px-1 py-1 bg-gray-900 border border-gray-700 rounded-t-lg border-b-0 flex-shrink-0">
            <TBtn label="B" action="bold" title="Fett (**text**)" />
            <TBtn label="I" action="italic" title="Kursiv (*text*)" />
            <span className="w-px h-5 bg-gray-700 mx-1 self-center" />
            <TBtn label="H2" action="h2" title="Überschrift 2 (## )" />
            <TBtn label="H3" action="h3" title="Überschrift 3 (### )" />
            <span className="w-px h-5 bg-gray-700 mx-1 self-center" />
            <TBtn label="&ldquo;" action="quote" title="Blockquote (> )" />
            <TBtn label="&bull;" action="ul" title="Aufzählung (- )" />
            <TBtn label="&lt;&gt;" action="code" title="Codeblock" />
            <span className="w-px h-5 bg-gray-700 mx-1 self-center" />
            <TBtn label="🔗" action="link" title="Link [Text](url)" />
            <TBtn label="🖼" action="image" title="Bild einfügen (öffnet Datei-Dialog)" />
            {uploadingInline && (
              <span className="text-xs text-gray-500 self-center ml-2">⟳ Lade Bild…</span>
            )}
          </div>

          <textarea
            ref={editorRef}
            value={form.content}
            onChange={e => {
              setForm(f => ({ ...f, content: e.target.value }))
              formRef.current.content = e.target.value
              markDirty()
            }}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            placeholder="Schreibe hier in Markdown…&#10;&#10;Tipp: Bilder per Drag&amp;Drop oder Einfügen (Ctrl+V) direkt im Editor hochladen."
            className="flex-1 w-full bg-gray-900 border border-gray-700 rounded-b-lg px-4 py-3 text-white text-sm font-mono resize-none focus:outline-none focus:border-violet-500 leading-relaxed"
          />
        </div>

        {/* Preview */}
        <div className="flex flex-col flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-1.5 px-1 font-medium uppercase tracking-widest flex-shrink-0">
            Vorschau
          </p>
          <div
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-5 py-4 overflow-auto text-sm
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-4 [&_h1]:mb-2
              [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-4 [&_h2]:mb-2
              [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mt-3 [&_h3]:mb-1
              [&_p]:text-gray-300 [&_p]:mb-3 [&_p]:leading-relaxed
              [&_ul]:text-gray-300 [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:list-disc
              [&_ol]:text-gray-300 [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal
              [&_li]:mb-1 [&_li]:text-gray-300
              [&_a]:text-violet-400
              [&_strong]:text-white [&_strong]:font-semibold
              [&_em]:italic [&_em]:text-gray-300
              [&_code]:text-violet-300 [&_code]:bg-gray-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
              [&_pre]:bg-gray-800 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:mb-3 [&_pre]:overflow-x-auto
              [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0
              [&_blockquote]:border-l-2 [&_blockquote]:border-violet-600 [&_blockquote]:pl-4 [&_blockquote]:text-gray-400 [&_blockquote]:italic [&_blockquote]:mb-3
              [&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-2
              [&_hr]:border-gray-700 [&_hr]:my-4
              [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:text-gray-400 [&_th]:pb-2 [&_td]:text-gray-300 [&_td]:py-1"
          >
            {form.content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {form.content}
              </ReactMarkdown>
            ) : (
              <p className="text-gray-600 italic">Vorschau erscheint beim Schreiben…</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Auszug ──────────────────────────────────────────────────────────── */}
      <div className="mt-3 flex-shrink-0">
        <input
          type="text"
          value={form.excerpt}
          onChange={e => {
            setForm(f => ({ ...f, excerpt: e.target.value }))
            formRef.current.excerpt = e.target.value
            markDirty()
          }}
          placeholder="Auszug (optional — sonst wird er beim Build automatisch aus dem Inhalt generiert)"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-violet-500 placeholder-gray-600"
        />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Filter = 'all' | 'draft' | 'published'

const LANG_LABELS: Record<string, string> = { de: '🇩🇪 DE', en: '🇬🇧 EN', ar: '🇸🇦 AR' }

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

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function deletePost(post: ThoughtPost) {
    if (!confirm(`Beitrag „${post.title || 'Entwurf'}" wirklich löschen?`)) return

    // Bucket aufräumen (best effort)
    try {
      const { data: files } = await supabase.storage
        .from('thoughts-media')
        .list(`thoughts/${post.id}`)
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
      await log({ action: 'delete', status: 'success', message: post.title })
      setPosts(ps => ps.filter(p => p.id !== post.id))
    }
  }

  // ── List Update after Save ───────────────────────────────────────────────────

  function handleSaved(updated: ThoughtPost) {
    setPosts(ps => {
      const idx = ps.findIndex(p => p.id === updated.id)
      if (idx >= 0) return ps.map(p => p.id === updated.id ? updated : p)
      return [updated, ...ps]
    })
  }

  // ── Slug Uniqueness for Composer ─────────────────────────────────────────────

  const editingSlug = composerForm?.slug ?? null
  const existingSlugs = posts
    .filter(p => p.slug !== editingSlug)
    .map(p => p.slug)

  const filtered = posts.filter(p => filter === 'all' || p.status === filter)

  // ── Composer View ────────────────────────────────────────────────────────────

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

  // ── List View ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Thoughts</h2>
          <p className="text-gray-400 text-sm mt-1">Blog-Posts schreiben, bearbeiten, veröffentlichen</p>
        </div>
        <button
          onClick={() => setComposerForm(emptyForm())}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Neuer Post
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-5">
        {(['all', 'draft', 'published'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f
                ? 'bg-violet-600/20 text-violet-300 font-medium'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {f === 'all' ? 'Alle' : f === 'draft' ? 'Entwürfe' : 'Live'}
            <span className="ml-1.5 text-xs text-gray-600">
              {f === 'all' ? posts.length : posts.filter(p => p.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* Post List */}
      {loading ? (
        <div className="text-gray-500 text-sm text-center py-12">Lädt…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600 border border-dashed border-gray-800 rounded-xl">
          <p className="text-lg mb-2">
            {posts.length === 0 ? 'Noch keine Beiträge' : 'Keine Beiträge in dieser Kategorie'}
          </p>
          {posts.length === 0 && (
            <p className="text-sm">Klicke „+ Neuer Post" um den ersten Gedanken zu schreiben.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(post => (
            <div
              key={post.id}
              className={`flex items-center gap-3 p-3 bg-gray-900 border rounded-lg group hover:border-gray-700 transition-colors ${
                post.status === 'published' ? 'border-gray-800' : 'border-gray-800 opacity-75'
              }`}
            >
              {/* Cover Thumbnail */}
              {post.cover_image_url ? (
                <img
                  src={post.cover_image_url}
                  alt=""
                  className="w-14 h-9 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-9 rounded flex-shrink-0 bg-gradient-to-br from-violet-900 to-purple-800 opacity-50" />
              )}

              {/* Meta */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {post.title || <span className="text-gray-600 italic">Kein Titel</span>}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-gray-500 text-xs">
                    {fmtDate(post.published_at ?? post.created_at)}
                  </span>
                  <span className="text-gray-700">·</span>
                  <span className="text-gray-500 text-xs">{LANG_LABELS[post.lang] ?? post.lang}</span>
                  {post.tags.slice(0, 3).map(tag => (
                    <span
                      key={tag}
                      className="text-xs text-violet-400 bg-violet-900/20 px-1.5 py-0.5 rounded-full border border-violet-800/40"
                    >
                      {tag}
                    </span>
                  ))}
                  {post.tags.length > 3 && (
                    <span className="text-xs text-gray-600">+{post.tags.length - 3}</span>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${
                post.status === 'published'
                  ? 'text-green-400 bg-green-900/20 border-green-800'
                  : 'text-gray-500 bg-gray-800 border-gray-700'
              }`}>
                {post.status === 'published' ? '● Live' : '○ Entwurf'}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setComposerForm(postToForm(post))}
                  className="text-gray-500 hover:text-white p-1.5 rounded hover:bg-gray-800 transition-colors text-sm"
                  title="Bearbeiten"
                >✎</button>
                <button
                  onClick={() => deletePost(post)}
                  className="text-gray-600 hover:text-red-400 p-1.5 rounded hover:bg-gray-800 transition-colors text-sm"
                  title="Löschen"
                >🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
