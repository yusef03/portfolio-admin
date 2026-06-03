'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'

type ActivityItem = {
  id: string
  action: string
  category: string
  status: 'success' | 'warning' | 'error' | 'info'
  message: string | null
  details: Record<string, unknown>
  error: string | null
  created_at: string
}

const STATUS_ICON = {
  success: <CheckCircle size={12} strokeWidth={2} className="text-[var(--color-success)] shrink-0 mt-0.5" />,
  warning: <AlertTriangle size={12} strokeWidth={2} className="text-[var(--color-warning)] shrink-0 mt-0.5" />,
  error:   <XCircle size={12} strokeWidth={2} className="text-[var(--color-danger)] shrink-0 mt-0.5" />,
  info:    <Info size={12} strokeWidth={2} className="text-[var(--color-accent)] shrink-0 mt-0.5" />,
} as const

const CATEGORY_LABEL: Record<string, string> = {
  translations: 'Translations', maintenance: 'Maintenance', projects: 'Projects',
  bot_memory: 'Bot Memory', media: 'Media', roadmap: 'Roadmap',
  changelog: 'Changelog', thoughts: 'Thoughts', auth: 'Auth', system: 'System',
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return new Date(iso).toLocaleDateString('de-DE')
}

export function ActivityFeed({ limit = 10, compact = false }: { limit?: number; compact?: boolean }) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/activity?limit=${limit}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!cancelled) setItems(data.items ?? [])
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const iv = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [limit])

  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-text-3)]">
      <span className="w-3 h-3 rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)] animate-spin" />
      Lädt…
    </div>
  )

  if (items.length === 0) return (
    <div className="text-xs text-[var(--color-text-3)] italic">
      Noch keine Aktivität — sobald du etwas im Admin Panel änderst, erscheint es hier.
    </div>
  )

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      {items.map(item => (
        <div
          key={item.id}
          className="flex items-start gap-2.5 text-xs py-2 border-b border-[var(--color-border)] last:border-0"
        >
          <span className="font-mono text-[10px] text-[var(--color-text-3)] w-10 shrink-0 pt-0.5">
            {timeAgo(item.created_at)}
          </span>
          {STATUS_ICON[item.status]}
          <span className="text-[var(--color-text-3)] w-20 shrink-0 truncate pt-0.5 hidden sm:block">
            {CATEGORY_LABEL[item.category] ?? item.category}
          </span>
          <span className="text-[var(--color-text-2)] flex-1 min-w-0">
            {item.message ?? item.action}
            {item.error && (
              <span className="block text-[var(--color-danger)] text-[10px] mt-0.5 truncate">{item.error}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
