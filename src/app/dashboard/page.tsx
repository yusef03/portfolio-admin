'use client'

import { useEffect, useState } from 'react'
import { HealthCard } from '@/components/HealthCard'
import { ActivityFeed } from '@/components/ActivityFeed'
import type { SystemHealth, ServiceStatus } from '@/lib/health'

const OVERALL_LABEL: Record<ServiceStatus, { text: string; color: string; emoji: string }> = {
  healthy:  { text: 'Alle Systeme normal', color: 'text-green-300', emoji: '🟢' },
  degraded: { text: 'Eingeschränkter Betrieb', color: 'text-yellow-300', emoji: '🟡' },
  down:     { text: 'Fehler erkannt — Eingriff nötig', color: 'text-red-300', emoji: '🔴' },
  unknown:  { text: 'Status wird geprüft…', color: 'text-gray-400', emoji: '⚪' },
}

const QUICK_AREAS = [
  { href: '/dashboard/translations', label: 'Translations', icon: '🌐' },
  { href: '/dashboard/maintenance', label: 'Maintenance', icon: '⚙️' },
  { href: '/dashboard/projects', label: 'Projects', icon: '📁' },
  { href: '/dashboard/bot-memory', label: 'Bot Memory', icon: '🤖' },
  { href: '/dashboard/media', label: 'Media', icon: '🖼️' },
  { href: '/dashboard/roadmap', label: 'Roadmap', icon: '🗺️' },
  { href: '/dashboard/changelog', label: 'Changelog', icon: '📋' },
  { href: '/dashboard/thoughts', label: 'Thoughts', icon: '✍️' },
]

export default function DashboardPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastCheck, setLastCheck] = useState<number>(0)

  async function loadHealth() {
    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setHealth(data)
      setLastCheck(Date.now())
    } catch {
      setHealth({
        overall: 'unknown',
        checkedAt: new Date().toISOString(),
        services: [],
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHealth()
    const iv = setInterval(loadHealth, 30_000)
    return () => clearInterval(iv)
  }, [])

  const overallInfo = health ? OVERALL_LABEL[health.overall] : OVERALL_LABEL.unknown
  const ageSec = lastCheck ? Math.floor((Date.now() - lastCheck) / 1000) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Übersicht</h2>
          <p className="text-gray-500 text-sm mt-1">Live-Status aller Subsysteme · Auto-Refresh alle 30s</p>
        </div>
        <button
          onClick={loadHealth}
          className="px-3 py-1.5 text-xs rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 transition-colors"
        >
          {loading ? '⏳ Prüft…' : '↻ Jetzt prüfen'}
          {lastCheck > 0 && <span className="ml-2 text-gray-600">vor {ageSec}s</span>}
        </button>
      </div>

      {/* Overall Banner */}
      <div className={`rounded-xl border p-4 ${
        health?.overall === 'healthy' ? 'border-green-900/50 bg-green-950/20' :
        health?.overall === 'degraded' ? 'border-yellow-900/50 bg-yellow-950/20' :
        health?.overall === 'down' ? 'border-red-900/50 bg-red-950/20' :
        'border-gray-800 bg-gray-900/50'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{overallInfo.emoji}</span>
          <div className={`font-medium ${overallInfo.color}`}>{overallInfo.text}</div>
        </div>
      </div>

      {/* Health Grid */}
      <section>
        <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-3">Health</h3>
        {loading && !health ? (
          <div className="text-gray-500 text-sm py-4">Lädt…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {health?.services.map(svc => (
              <HealthCard key={svc.name} service={svc} />
            ))}
          </div>
        )}
      </section>

      {/* Activity Feed */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-xs uppercase tracking-widest text-gray-500">Aktuelle Aktivität</h3>
          <a href="/dashboard/activity" className="text-xs text-purple-400 hover:text-purple-300">Alle anzeigen →</a>
        </div>
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
          <ActivityFeed limit={10} compact />
        </div>
      </section>

      {/* Quick Access */}
      <section>
        <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-3">Schnellzugriff</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_AREAS.map(area => (
            <a
              key={area.href}
              href={area.href}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-violet-600/50 hover:bg-gray-800/50 transition-all group flex items-center gap-3"
            >
              <span className="text-xl">{area.icon}</span>
              <span className="text-sm text-gray-300 group-hover:text-violet-300 transition-colors font-medium">
                {area.label}
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
