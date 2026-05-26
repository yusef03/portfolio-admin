'use client'

import { useEffect, useState } from 'react'

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
  success: '✓',
  warning: '⚠',
  error: '✗',
  info: 'ℹ',
} as const

const STATUS_COLOR = {
  success: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  info: 'text-blue-400',
} as const

const CATEGORY_LABEL: Record<string, string> = {
  translations: 'Translations',
  maintenance: 'Maintenance',
  projects: 'Projects',
  bot_memory: 'Bot Memory',
  media: 'Media',
  roadmap: 'Roadmap',
  changelog: 'Changelog',
  thoughts: 'Thoughts',
  auth: 'Auth',
  system: 'System',
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `vor ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `vor ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h}h`
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

  if (loading) return <div className="text-gray-500 text-xs">Lädt…</div>

  if (items.length === 0) {
    return (
      <div className="text-gray-500 text-xs italic">
        Noch keine Aktivität — sobald du etwas im Admin Panel änderst, erscheint es hier.
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {items.map(item => (
        <div key={item.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-gray-900 last:border-0">
          <span className="text-[10px] text-gray-500 font-mono w-14 shrink-0 pt-0.5">{timeAgo(item.created_at)}</span>
          <span className={`shrink-0 font-mono ${STATUS_COLOR[item.status]} pt-0.5`}>{STATUS_ICON[item.status]}</span>
          <span className="text-gray-500 w-24 shrink-0 truncate pt-0.5">{CATEGORY_LABEL[item.category] ?? item.category}</span>
          <span className="text-gray-300 flex-1 min-w-0">
            {item.message ?? item.action}
            {item.error && (
              <span className="block text-red-400 text-[10px] mt-0.5 truncate">{item.error}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
