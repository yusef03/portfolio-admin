'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useToast } from '@/components/Toast'
import { convertToWebP, formatFileSize, getFileType } from '@/lib/media'
import { PageHeader, Button, Card, Badge, Segmented, PageTransition, EmptyState } from '@/components/ui'
import { RefreshCw, Link2, Upload, AlertTriangle, FileVideo, FileText, Paperclip, ImageOff, Loader2 } from 'lucide-react'
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
        className="w-full h-full object-cover rounded-lg bg-[var(--color-surface-2)]"
        loading="lazy"
        onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
      />
    )
  }
  const Ico = type === 'video' ? FileVideo : type === 'document' ? FileText : Paperclip
  return (
    <div className="w-full h-full flex items-center justify-center rounded-[10px]" style={{ background: 'var(--color-surface-2)' }}>
      <Ico size={22} strokeWidth={1.4} className="text-[var(--color-text-3)]" />
    </div>
  )
}

function UsedInChips({ usedIn, isOrphan }: { usedIn: string[]; isOrphan: boolean }) {
  if (isOrphan) {
    return <Badge variant="warning" dot>Orphan</Badge>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {usedIn.slice(0, 2).map(ref => (
        <span key={ref} title={ref}
          className="text-[10px] px-1.5 py-0.5 rounded-[6px] text-[var(--color-text-2)] truncate max-w-[120px] font-mono" style={{ background: 'var(--color-surface-2)' }}>
          {ref.length > 20 ? ref.slice(0, 18) + '…' : ref}
        </span>
      ))}
      {usedIn.length > 2 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-[6px] text-[var(--color-text-3)]" style={{ background: 'var(--color-surface-2)' }}>
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
      className="group rounded-[14px] border p-3 flex gap-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{ background: 'var(--color-surface-1)', borderColor: asset.is_orphan ? 'rgba(255,214,10,.3)' : 'var(--color-border)' }}
    >
      <div className="w-16 h-16 shrink-0 relative rounded-[10px] overflow-hidden">
        <FilePreview url={publicUrl} type={type} name={fileName} />
        {replacing && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-[10px]">
            <Loader2 size={16} className="animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-[13px] text-[var(--color-text-1)] font-medium truncate" title={asset.path}>{fileName}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-[var(--color-text-3)] font-mono">{formatFileSize(asset.size_bytes)}</span>
          {asset.has_webp && <Badge variant="success">WebP</Badge>}
        </div>
        <UsedInChips usedIn={asset.used_in} isOrphan={asset.is_orphan} />
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={copyUrl}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-[7px] text-[var(--color-text-2)] hover:text-[var(--color-text-1)] transition-colors" style={{ background: 'var(--color-surface-2)' }}>
            <Link2 size={11} /> URL
          </button>
          {!isVideo && (
            <button onClick={() => inputRef.current?.click()} disabled={replacing}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-[7px] font-medium text-[var(--color-brand)] disabled:opacity-50 transition-colors"
              style={{ background: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.2)' }}>
              <Upload size={11} /> Ersetzen
            </button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept={getAccept(type)} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onReplace(asset, f); e.target.value = '' } }} />
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
    <div className="rounded-[14px] border p-3 flex gap-3 transition-all duration-200"
      style={{ background: 'var(--color-surface-1)', borderColor: asset.is_orphan ? 'rgba(255,214,10,.3)' : 'var(--color-border)' }}>
      <div className="w-16 h-16 shrink-0 rounded-[10px] overflow-hidden">
        <FilePreview url={publicUrl} type={type} name={fileName} />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-[13px] text-[var(--color-text-1)] font-medium truncate" title={asset.path}>{fileName}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-[var(--color-text-3)] font-mono">{formatFileSize(asset.size_bytes)}</span>
          {asset.has_webp && <Badge variant="success">WebP</Badge>}
          <Badge variant="default">read-only</Badge>
        </div>
        <UsedInChips usedIn={asset.used_in} isOrphan={asset.is_orphan} />
        <button onClick={copyUrl}
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-[7px] text-[var(--color-text-2)] hover:text-[var(--color-text-1)] transition-colors" style={{ background: 'var(--color-surface-2)' }}>
          <Link2 size={11} /> URL
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
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-base">{icon}</span>
        <h3 className="text-[15px] font-semibold text-[var(--color-text-1)]">{label}</h3>
        {editable ? <Badge variant="accent">editierbar</Badge> : <Badge variant="default">read-only</Badge>}
        <span className="text-[11px] text-[var(--color-text-3)]">{assets.length} Datei{assets.length !== 1 ? 'en' : ''}</span>
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
    <PageTransition className="space-y-6 max-w-5xl">
      <PageHeader
        title="Media"
        subtitle={manifest ? `${manifest.summary.count} Assets · Manifest vom ${new Date(manifest.generated_at).toLocaleDateString('de-DE')}` : 'Bilder, CV & Dokumente verwalten'}
        actions={<Button variant="secondary" size="sm" loading={loading} icon={<RefreshCw size={13} />} onClick={loadManifest}>Aktualisieren</Button>}
      />

      {/* Deploy info */}
      {deployInfo && (
        <div className="flex items-center gap-2 rounded-[12px] border px-3.5 py-2.5 text-[13px]"
          style={{ borderColor: 'rgba(255,214,10,.3)', background: 'rgba(255,214,10,.06)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-[var(--color-text-2)]">Commit erstellt · ~2 Min bis live</span>
          <a href={deployInfo.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand)] hover:opacity-70 ml-auto">GitHub →</a>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Segmented<Filter> value={filter} onChange={setFilter}
          options={[{ id: 'all', label: 'Alle' }, { id: 'orphans', label: `Orphans${orphanCount > 0 ? ` (${orphanCount})` : ''}` }]} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-3)]">
          <Loader2 size={18} className="animate-spin" /><span className="text-sm">Medien werden geladen…</span>
        </div>
      )}

      {/* Error */}
      {!loading && manifestError && (
        <Card accent="warning" className="p-5 space-y-2">
          <div className="flex items-center gap-2 text-[var(--color-warning)]">
            <AlertTriangle size={16} />
            <h3 className="text-sm font-semibold">Repo-Assets nicht verfügbar</h3>
          </div>
          <p className="text-xs text-[var(--color-text-2)]">{manifestError}</p>
          <p className="text-xs text-[var(--color-text-3)]">Lokal ausführen: <code className="px-1.5 py-0.5 rounded text-[var(--color-brand)]" style={{ background: 'var(--color-surface-2)' }}>node scripts/build-media-manifest.mjs</code></p>
        </Card>
      )}

      {/* Sections */}
      {!loading && manifest && allGroups.map(group => {
        const assets = getGroupAssets(group)
        if (assets.length === 0) return null
        return <MediaSection key={group.key} icon={group.icon} label={group.label} editable={group.editable} assets={assets} onReplace={replaceAsset} replacingPath={replacing} />
      })}

      {!loading && manifest && filter === 'orphans' && orphanCount === 0 && (
        <EmptyState icon={ImageOff} title="Keine Orphans" hint="Alle Assets werden irgendwo verwendet — sauber!" />
      )}
    </PageTransition>
  )
}
