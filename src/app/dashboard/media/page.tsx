'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/components/Toast'
import { convertToWebP, formatFileSize, getFileType, STORAGE_QUOTA_BYTES, BUCKET_LABELS, isCvFile } from '@/lib/media'
import type { StorageFile, MediaManifest, MediaManifestEntry, Project, ThoughtPost } from '@/lib/types'

// ─── Supabase ─────────────────────────────────────────────────────────────────

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

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
      body: JSON.stringify({ ...payload, category: 'media' }),
    })
  } catch { /* silent */ }
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function getPublicUrl(bucket: string, name: string): string {
  return supabase.storage.from(bucket).getPublicUrl(name).data.publicUrl
}

function buildWhereUsed(
  bucket: string,
  name: string,
  projects: Project[],
  thoughts: ThoughtPost[]
): string[] {
  if (isCvFile(bucket, name)) return ['index.html (CV-Link)']

  const publicUrl = getPublicUrl(bucket, name)
  const refs: string[] = []

  for (const p of projects) {
    if (p.image_url && (p.image_url.includes(name) || p.image_url === publicUrl)) {
      refs.push(`Projekt: ${p.title}`)
    }
  }
  for (const t of thoughts) {
    if (t.image_url && (t.image_url.includes(name) || t.image_url === publicUrl)) {
      refs.push(`Thought: ${t.title}`)
    }
  }
  return refs
}

// ─── Sub-Komponenten ──────────────────────────────────────────────────────────

function QuotaBar({ usedBytes }: { usedBytes: number }) {
  const pct = Math.min((usedBytes / STORAGE_QUOTA_BYTES) * 100, 100)
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-purple-500'
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-400 shrink-0">Storage</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-400 shrink-0 tabular-nums">
        {formatFileSize(usedBytes)} / 1 GB
        <span className="text-gray-600 ml-1">({pct.toFixed(1)}%)</span>
      </span>
    </div>
  )
}

function FilePreview({ url, type, name }: { url: string; type: string; name: string }) {
  if (type === 'image' || type === 'vector') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="w-full h-full object-cover rounded-lg bg-gray-800"
        loading="lazy"
        onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
      />
    )
  }
  const icons: Record<string, string> = { video: '🎬', document: '📄', other: '📎' }
  return (
    <div className="w-full h-full flex items-center justify-center text-3xl bg-gray-800 rounded-lg">
      {icons[type] ?? '📎'}
    </div>
  )
}

function UsedInChips({ usedIn, isOrphan }: { usedIn: string[]; isOrphan: boolean }) {
  if (isOrphan) {
    return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-950 border border-yellow-800 text-yellow-400">Orphan</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {usedIn.slice(0, 2).map(ref => (
        <span key={ref} className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 truncate max-w-[120px]" title={ref}>
          {ref.length > 20 ? ref.slice(0, 18) + '…' : ref}
        </span>
      ))}
      {usedIn.length > 2 && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">+{usedIn.length - 2}</span>
      )}
    </div>
  )
}

// ─── Storage Asset Card ───────────────────────────────────────────────────────

function StorageAssetCard({
  file,
  onDelete,
  onRename,
}: {
  file: StorageFile
  onDelete: (f: StorageFile) => void
  onRename: (f: StorageFile) => void
}) {
  const toast = useToast()
  const type = getFileType(file.name)

  const copyUrl = () => {
    navigator.clipboard.writeText(file.public_url).then(() => toast.success('URL kopiert'))
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex gap-3 group hover:border-gray-700 transition-colors">
      <div className="w-16 h-16 shrink-0">
        <FilePreview url={file.public_url} type={type} name={file.name} />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm text-white font-medium truncate" title={file.name}>{file.name}</p>
        <p className="text-xs text-gray-500">{formatFileSize(file.size_bytes)}</p>
        <UsedInChips usedIn={file.used_in} isOrphan={file.used_in.length === 0} />
        <div className="flex gap-1 pt-0.5">
          <button
            onClick={copyUrl}
            className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
            title="Public URL kopieren"
          >
            🔗 URL
          </button>
          <button
            onClick={() => onRename(file)}
            className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
            title="Umbenennen"
          >
            ✏️
          </button>
          <button
            onClick={() => onDelete(file)}
            className="px-2 py-1 text-xs rounded bg-gray-800 text-red-400 hover:bg-red-950 hover:text-red-300 transition-colors"
            title="Löschen"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Repo Asset Card ──────────────────────────────────────────────────────────

function RepoAssetCard({ asset, baseUrl }: { asset: MediaManifestEntry; baseUrl: string }) {
  const toast = useToast()
  const type = asset.type

  const publicUrl = `${baseUrl}/${asset.path}`
  const copyPath  = () => navigator.clipboard.writeText(publicUrl).then(() => toast.success('URL kopiert'))

  return (
    <div className={`bg-gray-900 border rounded-xl p-3 flex gap-3 hover:border-gray-700 transition-colors ${
      asset.is_orphan ? 'border-yellow-900/40' : 'border-gray-800'
    }`}>
      <div className="w-16 h-16 shrink-0">
        <FilePreview url={publicUrl} type={type} name={asset.path} />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm text-white font-medium truncate" title={asset.path}>
          {asset.path.split('/').pop()}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500">{formatFileSize(asset.size_bytes)}</span>
          {asset.has_webp && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-950 border border-green-800 text-green-400">WebP ✓</span>
          )}
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">Repo</span>
        </div>
        <UsedInChips usedIn={asset.used_in} isOrphan={asset.is_orphan} />
        <button
          onClick={copyPath}
          className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
        >
          🔗 URL
        </button>
      </div>
    </div>
  )
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({
  bucket,
  onUpload,
  uploading,
}: {
  bucket: string
  onUpload: (bucket: string, file: File) => Promise<void>
  uploading: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const info     = BUCKET_LABELS[bucket]
  const [dragging, setDragging] = useState(false)

  const handle = async (file: File) => {
    await onUpload(bucket, file)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handle(file)
      }}
      className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${
        dragging ? 'border-purple-500 bg-purple-950/20' : 'border-gray-700 hover:border-gray-600'
      }`}
      onClick={() => inputRef.current?.click()}
    >
      {uploading ? (
        <p className="text-sm text-purple-400">⏳ Wird hochgeladen…</p>
      ) : (
        <>
          <p className="text-sm text-gray-400">Datei hier ablegen oder klicken</p>
          <p className="text-xs text-gray-600 mt-1">{info?.hint}</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={info?.accept}
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) handle(e.target.files[0]) }}
      />
    </div>
  )
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

type Filter = 'all' | 'storage' | 'repo' | 'orphans'

interface DeleteModal { bucket: string; file: StorageFile }
interface RenameModal { bucket: string; file: StorageFile; newName: string }

export default function MediaPage() {
  const toast = useToast()

  const [manifest, setManifest]             = useState<MediaManifest | null>(null)
  const [manifestError, setManifestError]   = useState<string | null>(null)
  const [storageFiles, setStorageFiles]     = useState<Record<string, StorageFile[]>>({})
  const [usedBytes, setUsedBytes]           = useState(0)
  const [filter, setFilter]                 = useState<Filter>('all')
  const [loading, setLoading]               = useState(true)
  const [uploadingBucket, setUploadingBucket] = useState<string | null>(null)
  const [deleteModal, setDeleteModal]       = useState<DeleteModal | null>(null)
  const [renameModal, setRenameModal]       = useState<RenameModal | null>(null)

  // ── Daten laden ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)

    // Alle parallel starten
    const [manifestResult, projectsResult, thoughtsResult, ...bucketResults] = await Promise.allSettled([
      fetch('/api/media-manifest').then(r => r.json() as Promise<MediaManifest | { error: string }>),
      supabase.from('projects').select('id,title,image_url').then(r => r.data ?? []),
      supabase.from('thoughts').select('id,title,image_url').then(r => r.data ?? []),
      ...Object.keys(BUCKET_LABELS).map(bucket =>
        supabase.storage.from(bucket).list('', { limit: 500, sortBy: { column: 'name', order: 'asc' } })
          .then(r => ({ bucket, data: r.data ?? [] }))
      ),
    ])

    // Manifest
    if (manifestResult.status === 'fulfilled') {
      const val = manifestResult.value
      if ('error' in val) {
        setManifestError(val.error)
      } else {
        setManifest(val)
        setManifestError(null)
      }
    } else {
      setManifestError('Manifest konnte nicht geladen werden')
    }

    // Projects + Thoughts für where-used
    const projects = projectsResult.status === 'fulfilled' ? projectsResult.value as Project[] : []
    const thoughts  = thoughtsResult.status === 'fulfilled' ? thoughtsResult.value as ThoughtPost[] : []

    // Storage Buckets
    const newStorage: Record<string, StorageFile[]> = {}
    let totalBytes = 0

    for (const result of bucketResults) {
      if (result.status !== 'fulfilled') continue
      const { bucket, data } = result.value as { bucket: string; data: Array<{
        name: string
        metadata: { size?: number; contentLength?: number; mimetype?: string } | null
        updated_at: string
      }> }

      const files: StorageFile[] = data
        .filter(f => f.name && !f.name.startsWith('.') && f.metadata)
        .map(f => {
          const size = f.metadata?.size ?? f.metadata?.contentLength ?? 0
          totalBytes += size
          return {
            name:       f.name,
            size_bytes: size,
            mime_type:  f.metadata?.mimetype ?? '',
            updated_at: f.updated_at ?? '',
            public_url: getPublicUrl(bucket, f.name),
            bucket,
            used_in:    buildWhereUsed(bucket, f.name, projects, thoughts),
          }
        })

      newStorage[bucket] = files
    }

    setStorageFiles(newStorage)
    setUsedBytes(totalBytes)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Upload ───────────────────────────────────────────────────────────────────

  const handleUpload = async (bucket: string, rawFile: File) => {
    setUploadingBucket(bucket)
    let file = rawFile

    // WebP-Konvertierung für Rasterbilder
    const type = getFileType(rawFile.name)
    if (type === 'image') {
      const converted = await convertToWebP(rawFile)
      file = converted
      if (converted !== rawFile) {
        toast.info(`Konvertiert zu WebP: ${converted.name}`)
      }
    }

    const { error } = await supabase.storage
      .from(bucket)
      .upload(file.name, file, { upsert: true, contentType: file.type })

    if (error) {
      toast.error('Upload fehlgeschlagen', { detail: error.message })
      log({ action: 'file_upload_failed', status: 'error', error: error.message, details: { bucket, name: file.name } })
      setUploadingBucket(null)
      return
    }

    toast.success(`${file.name} hochgeladen`)
    log({ action: 'file_uploaded', status: 'success', message: `${file.name} in ${bucket} hochgeladen`, details: { bucket, name: file.name } })
    setUploadingBucket(null)
    await loadData()
  }

  // ── Löschen ──────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteModal) return
    const { bucket, file } = deleteModal
    setDeleteModal(null)

    const { error } = await supabase.storage.from(bucket).remove([file.name])

    if (error) {
      toast.error('Löschen fehlgeschlagen', { detail: error.message })
      log({ action: 'file_delete_failed', status: 'error', error: error.message, details: { bucket, name: file.name } })
      return
    }

    toast.success(`${file.name} gelöscht`)
    log({ action: 'file_deleted', status: 'success', message: `${file.name} aus ${bucket} gelöscht`, details: { bucket, name: file.name } })
    await loadData()
  }

  // ── Umbenennen (copy + delete) ───────────────────────────────────────────────

  const confirmRename = async () => {
    if (!renameModal) return
    const { bucket, file, newName } = renameModal
    if (!newName.trim() || newName === file.name) { setRenameModal(null); return }
    setRenameModal(null)

    // 1. Kopieren
    const { error: copyError } = await supabase.storage.from(bucket).copy(file.name, newName.trim())
    if (copyError) {
      toast.error('Umbenennen fehlgeschlagen', { detail: copyError.message })
      log({ action: 'file_rename_failed', status: 'error', error: copyError.message, details: { bucket, from: file.name, to: newName } })
      return
    }

    // 2. Original löschen
    const { error: delError } = await supabase.storage.from(bucket).remove([file.name])
    if (delError) {
      toast.warning(`Kopie erstellt als "${newName}", Original konnte nicht gelöscht werden`, { detail: delError.message })
    } else {
      toast.success(`Umbenannt zu "${newName}"`)
    }

    log({ action: 'file_renamed', status: 'success', message: `${file.name} → ${newName} in ${bucket}`, details: { bucket, from: file.name, to: newName } })
    await loadData()
  }

  // ── Filter-Logik ─────────────────────────────────────────────────────────────

  const allStorageFiles = Object.values(storageFiles).flat()
  const allRepoAssets   = manifest?.assets ?? []

  const showStorage = filter === 'all' || filter === 'storage' || filter === 'orphans'
  const showRepo    = filter === 'all' || filter === 'repo' || filter === 'orphans'

  const visibleStorageByBucket = (bucket: string): StorageFile[] => {
    const files = storageFiles[bucket] ?? []
    if (filter === 'orphans') return files.filter(f => f.used_in.length === 0)
    return files
  }

  const visibleRepoByCategory = (category: string): MediaManifestEntry[] => {
    const assets = allRepoAssets.filter(a => a.category === category)
    if (filter === 'orphans') return assets.filter(a => a.is_orphan)
    return assets
  }

  const PORTFOLIO_URL = 'https://yusefbach.de'

  // Repo-Kategorien für Anzeige
  const repoCategories = [
    { key: 'ui',        label: 'Design-Assets',    icon: '🎨' },
    { key: 'techstack', label: 'Tech-Icons',        icon: '⚙️' },
    { key: 'docs',      label: 'Dokumente (Repo)',  icon: '📁' },
  ]
  // Dynamische Projekt-Kategorien
  const projectCategories = [...new Set(allRepoAssets.map(a => a.category))]
    .filter(c => c.startsWith('projects-'))
    .sort()

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Media</h2>
          {manifest && (
            <p className="text-gray-500 text-xs mt-1">
              Manifest vom {new Date(manifest.generated_at).toLocaleString('de-DE')} ·
              {manifest.summary.count} Repo-Assets · {allStorageFiles.length} Storage-Dateien
            </p>
          )}
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 transition-colors disabled:opacity-50"
        >
          {loading ? '⏳ Lädt…' : '↻ Aktualisieren'}
        </button>
      </div>

      {/* Quota Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <QuotaBar usedBytes={usedBytes} />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([['all', 'Alle'], ['storage', 'Storage (editierbar)'], ['repo', 'Repo (read-only)'], ['orphans', 'Orphans']] as [Filter, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              filter === val
                ? 'bg-purple-600 text-white'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {label}
            {val === 'orphans' && manifest && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-yellow-900 text-yellow-300 text-xs">
                {manifest.summary.orphans + allStorageFiles.filter(f => f.used_in.length === 0).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-gray-500 text-sm py-8 text-center">Medien werden geladen…</div>
      )}

      {/* ── Zone B — Storage (editierbar) ──────────────────────────────────── */}
      {!loading && showStorage && Object.entries(BUCKET_LABELS).map(([bucket, info]) => {
        const files = visibleStorageByBucket(bucket)
        const isUploading = uploadingBucket === bucket

        if (filter === 'orphans' && files.length === 0) return null

        return (
          <section key={bucket} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{info.icon}</span>
              <h3 className="text-sm font-semibold text-white">{info.label}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-300">
                editierbar
              </span>
              <span className="text-xs text-gray-500">{files.length} Dateien</span>
            </div>

            {files.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {files.map(file => (
                  <StorageAssetCard
                    key={`${bucket}/${file.name}`}
                    file={file}
                    onDelete={f => setDeleteModal({ bucket, file: f })}
                    onRename={f => setRenameModal({ bucket, file: f, newName: f.name })}
                  />
                ))}
              </div>
            )}

            {filter !== 'orphans' && (
              <UploadZone
                bucket={bucket}
                onUpload={handleUpload}
                uploading={isUploading}
              />
            )}
          </section>
        )
      })}

      {/* ── Zone A — Repo (read-only) ──────────────────────────────────────── */}
      {!loading && showRepo && manifestError ? (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400">
            <span>⚠️</span>
            <h3 className="text-sm font-semibold">Repo-Assets nicht verfügbar</h3>
          </div>
          <p className="text-xs text-gray-400">{manifestError}</p>
          <p className="text-xs text-gray-500">
            Lokal ausführen: <code className="bg-gray-800 px-1.5 py-0.5 rounded text-purple-300">node scripts/build-media-manifest.mjs</code>
          </p>
        </section>
      ) : !loading && showRepo && manifest && (
        <>
          {/* Feste Kategorien */}
          {repoCategories.map(({ key, label, icon }) => {
            const assets = visibleRepoByCategory(key)
            if (filter === 'orphans' && assets.length === 0) return null
            return (
              <section key={key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  <h3 className="text-sm font-semibold text-white">{label}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">read-only</span>
                  <span className="text-xs text-gray-500">{assets.length} Dateien</span>
                </div>
                {assets.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {assets.map(asset => (
                      <RepoAssetCard key={asset.path} asset={asset} baseUrl={PORTFOLIO_URL} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 pl-8">Keine Einträge</p>
                )}
              </section>
            )
          })}

          {/* Dynamische Projekt-Kategorien */}
          {projectCategories.map(cat => {
            const assets = visibleRepoByCategory(cat)
            if (filter === 'orphans' && assets.length === 0) return null
            const slug = cat.replace('projects-', '')
            return (
              <section key={cat} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🗂</span>
                  <h3 className="text-sm font-semibold text-white capitalize">
                    Projekt: {slug}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">read-only</span>
                  <span className="text-xs text-gray-500">{assets.length} Dateien</span>
                </div>
                {assets.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {assets.map(asset => (
                      <RepoAssetCard key={asset.path} asset={asset} baseUrl={PORTFOLIO_URL} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </>
      )}

      {/* ── Löschen-Modal ─────────────────────────────────────────────────── */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-white font-semibold">Datei löschen?</h3>
            <p className="text-sm text-gray-400">
              <span className="text-white font-mono">{deleteModal.file.name}</span> aus{' '}
              <span className="text-purple-300">{BUCKET_LABELS[deleteModal.bucket]?.label}</span> permanent löschen?
            </p>
            {deleteModal.file.used_in.length > 0 && (
              <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-3">
                <p className="text-xs text-red-400 font-medium">⚠️ Noch in Verwendung:</p>
                <ul className="mt-1 space-y-0.5">
                  {deleteModal.file.used_in.map(ref => (
                    <li key={ref} className="text-xs text-red-300">{ref}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Umbenennen-Modal ───────────────────────────────────────────────── */}
      {renameModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-white font-semibold">Datei umbenennen</h3>
            <p className="text-xs text-gray-500">
              Supabase kann nicht atomar umbenennen (copy + delete). Beide Schritte werden ausgeführt.
            </p>
            <input
              type="text"
              value={renameModal.newName}
              onChange={e => setRenameModal(m => m ? { ...m, newName: e.target.value } : null)}
              onKeyDown={e => { if (e.key === 'Enter') confirmRename() }}
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-950 border border-gray-700 text-white font-mono focus:outline-none focus:border-purple-500"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenameModal(null)}
                className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmRename}
                disabled={!renameModal.newName.trim() || renameModal.newName === renameModal.file.name}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium disabled:opacity-50 transition-colors"
              >
                Umbenennen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
