'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useToast } from '@/components/Toast'
import { convertToWebP, formatFileSize, getFileType } from '@/lib/media'
import type { MediaManifest, MediaManifestEntry } from '@/lib/types'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PORTFOLIO_URL = 'https://yusefbach.de'

function toTitle(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
}

function getAccept(type: string): string {
  if (type === 'image')    return 'image/*'
  if (type === 'vector')   return '.svg,image/svg+xml'
  if (type === 'document') return '.pdf,.doc,.docx'
  return '*'
}

// ─── Sub-Komponenten ──────────────────────────────────────────────────────────

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
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-950 border border-yellow-800 text-yellow-400">
        Orphan
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {usedIn.slice(0, 2).map(ref => (
        <span
          key={ref}
          className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 truncate max-w-[120px]"
          title={ref}
        >
          {ref.length > 20 ? ref.slice(0, 18) + '…' : ref}
        </span>
      ))}
      {usedIn.length > 2 && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">
          +{usedIn.length - 2}
        </span>
      )}
    </div>
  )
}

// ─── Editierbare Asset-Karte ──────────────────────────────────────────────────

function EditableAssetCard({
  asset,
  onReplace,
  replacing,
}: {
  asset: MediaManifestEntry
  onReplace: (asset: MediaManifestEntry, file: File) => Promise<void>
  replacing: boolean
}) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const fileName = asset.path.split('/').pop()!
  const type     = getFileType(fileName)
  const isVideo  = type === 'video'
  const publicUrl = `${PORTFOLIO_URL}/${asset.path}`

  const copyUrl = () =>
    navigator.clipboard.writeText(publicUrl).then(() => toast.success('URL kopiert'))

  return (
    <div
      className={`bg-gray-900 border rounded-xl p-3 flex gap-3 transition-colors ${
        asset.is_orphan ? 'border-yellow-900/40' : 'border-gray-800 hover:border-gray-700'
      }`}
    >
      <div className="w-16 h-16 shrink-0 relative">
        <FilePreview url={publicUrl} type={type} name={fileName} />
        {replacing && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
            <span className="text-white text-xs">⏳</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm text-white font-medium truncate" title={asset.path}>
          {fileName}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500">{formatFileSize(asset.size_bytes)}</span>
          {asset.has_webp && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-950 border border-green-800 text-green-400">
              WebP ✓
            </span>
          )}
        </div>
        <UsedInChips usedIn={asset.used_in} isOrphan={asset.is_orphan} />
        <div className="flex gap-1 pt-0.5">
          <button
            onClick={copyUrl}
            className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            🔗 URL
          </button>
          {!isVideo && (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={replacing}
              className="px-2 py-1 text-xs rounded bg-purple-950 border border-purple-800 text-purple-300 hover:bg-purple-900 disabled:opacity-50 transition-colors"
            >
              {replacing ? '⏳ …' : '↑ Ersetzen'}
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={getAccept(type)}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) { onReplace(asset, f); e.target.value = '' }
        }}
      />
    </div>
  )
}

// ─── Read-only Asset-Karte ────────────────────────────────────────────────────

function ReadOnlyAssetCard({ asset }: { asset: MediaManifestEntry }) {
  const toast = useToast()
  const fileName  = asset.path.split('/').pop()!
  const type      = getFileType(fileName)
  const publicUrl = `${PORTFOLIO_URL}/${asset.path}`

  const copyUrl = () =>
    navigator.clipboard.writeText(publicUrl).then(() => toast.success('URL kopiert'))

  return (
    <div
      className={`bg-gray-900 border rounded-xl p-3 flex gap-3 transition-colors ${
        asset.is_orphan ? 'border-yellow-900/40' : 'border-gray-800 hover:border-gray-700'
      }`}
    >
      <div className="w-16 h-16 shrink-0">
        <FilePreview url={publicUrl} type={type} name={fileName} />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm text-white font-medium truncate" title={asset.path}>
          {fileName}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500">{formatFileSize(asset.size_bytes)}</span>
          {asset.has_webp && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-950 border border-green-800 text-green-400">
              WebP ✓
            </span>
          )}
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">read-only</span>
        </div>
        <UsedInChips usedIn={asset.used_in} isOrphan={asset.is_orphan} />
        <button
          onClick={copyUrl}
          className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
        >
          🔗 URL
        </button>
      </div>
    </div>
  )
}

// ─── Media-Sektion ────────────────────────────────────────────────────────────

function MediaSection({
  icon, label, editable, assets, onReplace, replacingPath,
}: {
  icon: string
  label: string
  editable: boolean
  assets: MediaManifestEntry[]
  onReplace: (asset: MediaManifestEntry, file: File) => Promise<void>
  replacingPath: string | null
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-semibold text-white">{label}</h3>
        {editable ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-300">
            editierbar
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
            read-only
          </span>
        )}
        <span className="text-xs text-gray-500">
          {assets.length} Datei{assets.length !== 1 ? 'en' : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {assets.map(asset =>
          editable ? (
            <EditableAssetCard
              key={asset.path}
              asset={asset}
              onReplace={onReplace}
              replacing={replacingPath === asset.path}
            />
          ) : (
            <ReadOnlyAssetCard key={asset.path} asset={asset} />
          )
        )}
      </div>
    </section>
  )
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

type LocationGroup = {
  key: string
  label: string
  icon: string
  categories: string[]
  editable: boolean
}

type Filter = 'all' | 'orphans'

export default function MediaPage() {
  const toast = useToast()

  const [manifest, setManifest]           = useState<MediaManifest | null>(null)
  const [manifestError, setManifestError] = useState<string | null>(null)
  const [loading, setLoading]             = useState(true)
  const [replacing, setReplacing]         = useState<string | null>(null)
  const [filter, setFilter]               = useState<Filter>('all')
  const [deployInfo, setDeployInfo]       = useState<{ url: string; time: Date } | null>(null)

  // ── Manifest laden ───────────────────────────────────────────────────────────

  const loadManifest = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/media-manifest')
      const data = await res.json() as MediaManifest | { error: string }
      if ('error' in data) {
        setManifestError(data.error)
      } else {
        setManifest(data)
        setManifestError(null)
      }
    } catch {
      setManifestError('Manifest konnte nicht geladen werden')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadManifest() }, [loadManifest])

  // ── Asset ersetzen (Admin-Commit) ────────────────────────────────────────────

  const replaceAsset = async (asset: MediaManifestEntry, rawFile: File) => {
    const type = getFileType(rawFile.name)
    if (type === 'video') return

    setReplacing(asset.path)
    const formData = new FormData()
    formData.append('path', asset.path)
    formData.append('file', rawFile)

    if (asset.has_webp && type === 'image') {
      const webpFile = await convertToWebP(rawFile)
      if (webpFile !== rawFile) {
        const webpPath = asset.path.replace(/\.(png|jpg|jpeg|gif)$/i, '.webp')
        formData.append('webpPath', webpPath)
        formData.append('webpFile', webpFile)
      }
    }

    try {
      const res  = await fetch('/api/repo-commit', { method: 'POST', body: formData })
      const data = await res.json() as { commitUrl?: string; error?: string }

      if (!res.ok || data.error) {
        toast.error('Ersetzen fehlgeschlagen', { detail: data.error })
        log({ action: 'asset_replace_failed', status: 'error', error: data.error, details: { path: asset.path } })
        setReplacing(null)
        return
      }

      toast.success('Commit erstellt · GitHub deployed in ~2 Min')
      setDeployInfo({ url: data.commitUrl!, time: new Date() })
      log({ action: 'asset_replaced', status: 'success', message: `${asset.path} ersetzt`, details: { path: asset.path } })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Netzwerkfehler', { detail: msg })
      log({ action: 'asset_replace_failed', status: 'error', error: msg, details: { path: asset.path } })
    }

    setReplacing(null)
  }

  // ── Gruppen berechnen ────────────────────────────────────────────────────────

  const allAssets   = manifest?.assets ?? []
  const orphanCount = allAssets.filter(a => a.is_orphan).length

  const staticGroups: LocationGroup[] = [
    { key: 'startseite', label: 'Startseite', icon: '🏠', categories: ['ui'],   editable: true },
    { key: 'dokumente',  label: 'Dokumente',  icon: '📄', categories: ['docs'], editable: true },
  ]

  const projectGroups: LocationGroup[] = [...new Set(allAssets.map(a => a.category))]
    .filter(c => c.startsWith('projects-'))
    .sort()
    .map(c => ({
      key: c,
      label: `Projekt: ${toTitle(c.replace('projects-', ''))}`,
      icon: '🗂',
      categories: [c],
      editable: true,
    }))

  const techGroup: LocationGroup = {
    key: 'techstack', label: 'Tech-Icons', icon: '⚙️', categories: ['techstack'], editable: false,
  }

  const allGroups: LocationGroup[] = [...staticGroups, ...projectGroups, techGroup]

  const getGroupAssets = (group: LocationGroup): MediaManifestEntry[] => {
    const assets = allAssets.filter(a => group.categories.includes(a.category))
    return filter === 'orphans' ? assets.filter(a => a.is_orphan) : assets
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Media</h2>
          {manifest && (
            <p className="text-gray-500 text-xs">
              Manifest vom {new Date(manifest.generated_at).toLocaleString('de-DE')} · {manifest.summary.count} Assets
            </p>
          )}
          {deployInfo && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
              <span>Commit erstellt · ~2 Min bis live ·</span>
              <a
                href={deployInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                GitHub →
              </a>
            </div>
          )}
        </div>
        <button
          onClick={loadManifest}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 transition-colors disabled:opacity-50"
        >
          {loading ? '⏳ Lädt…' : '↻ Aktualisieren'}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'orphans'] as Filter[]).map(val => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              filter === val
                ? 'bg-purple-600 text-white'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {val === 'all' ? 'Alle' : 'Orphans'}
            {val === 'orphans' && orphanCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-yellow-900 text-yellow-300 text-xs">
                {orphanCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-gray-500 text-sm py-12 text-center">Medien werden geladen…</div>
      )}

      {/* Manifest Error */}
      {!loading && manifestError && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400">
            <span>⚠️</span>
            <h3 className="text-sm font-semibold">Repo-Assets nicht verfügbar</h3>
          </div>
          <p className="text-xs text-gray-400">{manifestError}</p>
          <p className="text-xs text-gray-500">
            Lokal ausführen:{' '}
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-purple-300">
              node scripts/build-media-manifest.mjs
            </code>
          </p>
        </section>
      )}

      {/* Sections by Location */}
      {!loading && manifest && allGroups.map(group => {
        const assets = getGroupAssets(group)
        if (assets.length === 0) return null
        return (
          <MediaSection
            key={group.key}
            icon={group.icon}
            label={group.label}
            editable={group.editable}
            assets={assets}
            onReplace={replaceAsset}
            replacingPath={replacing}
          />
        )
      })}

    </div>
  )
}
