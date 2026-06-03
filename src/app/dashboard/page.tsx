'use client'

import { useEffect, useState } from 'react'
import { HealthCard } from '@/components/HealthCard'
import { ActivityFeed } from '@/components/ActivityFeed'
import { PageHeader, Card, Button, Badge, PageTransition, StaggerList, StaggerItem } from '@/components/ui'
import {
  Languages, ShieldAlert, FolderKanban, Bot, Image,
  MapPinned, ScrollText, PenLine, RefreshCw,
} from 'lucide-react'
import type { SystemHealth, ServiceStatus } from '@/lib/health'

const OVERALL_META: Record<ServiceStatus, { text: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  healthy:  { text: 'Alle Systeme normal',              variant: 'success' },
  degraded: { text: 'Eingeschränkter Betrieb',          variant: 'warning' },
  down:     { text: 'Fehler erkannt — Eingriff nötig',  variant: 'danger'  },
  unknown:  { text: 'Status wird geprüft…',             variant: 'default' },
}

const QUICK_AREAS = [
  { href: '/dashboard/translations', label: 'Translations', icon: Languages },
  { href: '/dashboard/maintenance',  label: 'Maintenance',  icon: ShieldAlert },
  { href: '/dashboard/projects',     label: 'Projects',     icon: FolderKanban },
  { href: '/dashboard/bot-memory',   label: 'Bot Memory',   icon: Bot },
  { href: '/dashboard/media',        label: 'Media',        icon: Image },
  { href: '/dashboard/roadmap',      label: 'Roadmap',      icon: MapPinned },
  { href: '/dashboard/changelog',    label: 'Changelog',    icon: ScrollText },
  { href: '/dashboard/thoughts',     label: 'Thoughts',     icon: PenLine },
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
      setHealth({ overall: 'unknown', checkedAt: new Date().toISOString(), services: [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHealth()
    const iv = setInterval(loadHealth, 30_000)
    return () => clearInterval(iv)
  }, [])

  const meta = health ? OVERALL_META[health.overall] : OVERALL_META.unknown
  const ageSec = lastCheck ? Math.floor((Date.now() - lastCheck) / 1000) : 0

  return (
    <PageTransition>
      <PageHeader
        title="Übersicht"
        subtitle="Live-Status aller Subsysteme · Auto-Refresh alle 30s"
        actions={
          <Button
            variant="secondary" size="sm"
            loading={loading}
            icon={<RefreshCw size={13} />}
            onClick={loadHealth}
          >
            {loading ? 'Prüft…' : 'Jetzt prüfen'}
            {lastCheck > 0 && !loading && (
              <span className="ml-1 text-[var(--color-text-3)]">vor {ageSec}s</span>
            )}
          </Button>
        }
      />

      {/* Overall Banner */}
      <div
        className="rounded-[var(--radius-lg)] border p-4 mb-6 flex items-center gap-3"
        style={{
          borderColor: health?.overall === 'healthy' ? 'rgba(34,197,94,.3)'
            : health?.overall === 'degraded' ? 'rgba(245,158,11,.3)'
            : health?.overall === 'down' ? 'rgba(239,68,68,.3)'
            : 'var(--color-border)',
          background: health?.overall === 'healthy' ? 'rgba(34,197,94,.06)'
            : health?.overall === 'degraded' ? 'rgba(245,158,11,.06)'
            : health?.overall === 'down' ? 'rgba(239,68,68,.06)'
            : 'var(--color-surface-1)',
        }}
      >
        <Badge variant={meta.variant} dot>{meta.text}</Badge>
      </div>

      {/* Health Grid */}
      <section className="mb-8">
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-3)] mb-3 font-medium">Health</p>
        {loading && !health ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-3)]">
            <span className="w-4 h-4 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)] animate-spin" />
            Lädt…
          </div>
        ) : (
          <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {health?.services.map(svc => (
              <StaggerItem key={svc.name}>
                <HealthCard service={svc} />
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </section>

      {/* Activity Feed */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-xs uppercase tracking-widest text-[var(--color-text-3)] font-medium">Aktuelle Aktivität</p>
          <a
            href="/dashboard/activity"
            className="text-xs text-[var(--color-accent)] hover:opacity-80 transition-opacity"
          >
            Alle anzeigen →
          </a>
        </div>
        <Card className="p-4">
          <ActivityFeed limit={10} compact />
        </Card>
      </section>

      {/* Quick Access */}
      <section>
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-3)] mb-3 font-medium">Schnellzugriff</p>
        <StaggerList className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_AREAS.map(area => {
            const Icon = area.icon
            return (
              <StaggerItem key={area.href}>
                <a
                  href={area.href}
                  className="group bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4
                    hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-surface-2)]
                    hover:-translate-y-0.5 hover:shadow-[var(--glow-brand)]
                    transition-all duration-200 flex items-center gap-3"
                >
                  <Icon
                    size={16} strokeWidth={1.75}
                    className="text-[var(--color-text-3)] group-hover:text-[var(--color-accent)] transition-colors shrink-0"
                  />
                  <span className="text-sm font-medium text-[var(--color-text-2)] group-hover:text-[var(--color-text-1)] transition-colors">
                    {area.label}
                  </span>
                </a>
              </StaggerItem>
            )
          })}
        </StaggerList>
      </section>
    </PageTransition>
  )
}
