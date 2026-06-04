'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { ActivityFeed } from '@/components/ActivityFeed'
import { PageTransition } from '@/components/ui'
import {
  Languages, FolderKanban, PenLine, MapPinned, ScrollText, Image,
  ShieldAlert, Bot, Activity, RefreshCw, ArrowRight, CircleCheck,
  CircleAlert, CircleX, CircleDashed,
} from 'lucide-react'
import type { SystemHealth, ServiceStatus } from '@/lib/health'

const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const OVERALL: Record<ServiceStatus, { text: string; color: string; Icon: typeof CircleCheck }> = {
  healthy:  { text: 'Alle Systeme normal',     color: 'var(--color-success)', Icon: CircleCheck },
  degraded: { text: 'Eingeschränkter Betrieb', color: 'var(--color-warning)', Icon: CircleAlert },
  down:     { text: 'Eingriff nötig',          color: 'var(--color-danger)',  Icon: CircleX },
  unknown:  { text: 'Status wird geprüft…',    color: 'var(--color-text-3)',  Icon: CircleDashed },
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 17) return 'Guten Tag'
  if (h < 22) return 'Guten Abend'
  return 'Gute Nacht'
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, value, label, href, loading }: {
  icon: typeof Languages; value: number | string; label: string; href: string; loading: boolean
}) {
  return (
    <a
      href={href}
      className="group relative overflow-hidden rounded-[18px] border p-5 transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'linear-gradient(165deg, var(--color-surface-1) 0%, var(--color-surface-0) 130%)',
        borderColor: 'var(--color-border)',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 14px 40px -16px rgba(0,0,0,0.5)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
    >
      {/* corner glow */}
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: 'radial-gradient(circle, rgba(10,132,255,0.18), transparent 70%)' }} />

      <div className="relative flex items-center justify-between">
        <div
          className="w-10 h-10 rounded-[12px] flex items-center justify-center transition-colors"
          style={{ background: 'rgba(10,132,255,0.12)' }}
        >
          <Icon size={18} strokeWidth={2} style={{ color: 'var(--color-brand)' }} />
        </div>
        <ArrowRight size={15} className="text-[var(--color-text-3)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
      </div>

      <div className="relative mt-4">
        <div className="text-[28px] leading-none font-semibold tracking-tight text-[var(--color-text-1)] tabular-nums">
          {loading ? <span className="inline-block w-10 h-6 rounded-md animate-pulse" style={{ background: 'var(--color-surface-2)' }} /> : value}
        </div>
        <div className="text-[13px] text-[var(--color-text-2)] mt-1.5">{label}</div>
      </div>
    </a>
  )
}

// ─── Quick Access Tile ───────────────────────────────────────────────────────

function QuickTile({ icon: Icon, label, desc, href }: { icon: typeof Languages; label: string; desc: string; href: string }) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3.5 rounded-[14px] border p-3.5 transition-all duration-200"
      style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-2)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface-1)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
    >
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-colors"
        style={{ background: 'var(--color-surface-2)' }}>
        <Icon size={16} strokeWidth={1.9} className="text-[var(--color-text-2)] group-hover:text-[var(--color-brand)] transition-colors" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--color-text-1)] truncate">{label}</p>
        <p className="text-[11px] text-[var(--color-text-3)] truncate">{desc}</p>
      </div>
    </a>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(true)
  const [counts, setCounts] = useState<{ translations: number; projects: number; thoughts: number; roadmap: number } | null>(null)
  const [lastCheck, setLastCheck] = useState(0)

  async function loadHealth() {
    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error()
      setHealth(await res.json())
      setLastCheck(Date.now())
    } catch {
      setHealth({ overall: 'unknown', checkedAt: new Date().toISOString(), services: [] })
    } finally { setLoadingHealth(false) }
  }

  async function loadCounts() {
    try {
      const [t, p, th, r] = await Promise.all([
        supabase.from('translations').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('thoughts').select('id', { count: 'exact', head: true }),
        supabase.from('roadmap').select('id', { count: 'exact', head: true }),
      ])
      setCounts({ translations: t.count ?? 0, projects: p.count ?? 0, thoughts: th.count ?? 0, roadmap: r.count ?? 0 })
    } catch { setCounts({ translations: 0, projects: 0, thoughts: 0, roadmap: 0 }) }
  }

  useEffect(() => {
    loadHealth(); loadCounts()
    const iv = setInterval(loadHealth, 30_000)
    return () => clearInterval(iv)
  }, [])

  const o = health ? OVERALL[health.overall] : OVERALL.unknown
  const ageSec = lastCheck ? Math.floor((Date.now() - lastCheck) / 1000) : 0
  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <PageTransition className="space-y-7">

      {/* ── Greeting ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[13px] text-[var(--color-text-3)] capitalize">{today}</p>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-text-1)] mt-1">
            {greeting()}, Yusef
          </h1>
        </div>
        <div
          className="flex items-center gap-2.5 rounded-full border pl-3 pr-3.5 py-1.5"
          style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}
        >
          <o.Icon size={15} style={{ color: o.color }} strokeWidth={2.2} />
          <span className="text-[12.5px] font-medium" style={{ color: o.color }}>{o.text}</span>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Languages}   value={counts?.translations ?? 0} label="Translation Keys" href="/dashboard/translations" loading={!counts} />
        <KpiCard icon={FolderKanban} value={counts?.projects ?? 0}     label="Projekte"         href="/dashboard/projects"     loading={!counts} />
        <KpiCard icon={PenLine}     value={counts?.thoughts ?? 0}     label="Blog-Posts"       href="/dashboard/thoughts"     loading={!counts} />
        <KpiCard icon={MapPinned}   value={counts?.roadmap ?? 0}      label="Roadmap-Einträge" href="/dashboard/roadmap"      loading={!counts} />
      </div>

      {/* ── Health + Activity ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

        {/* System Health */}
        <div className="lg:col-span-2 rounded-[18px] border p-5"
          style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-3)]">System Health</h2>
            <button onClick={loadHealth}
              className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors">
              <RefreshCw size={12} className={loadingHealth ? 'animate-spin' : ''} />
              {lastCheck > 0 && <span>vor {ageSec}s</span>}
            </button>
          </div>

          {loadingHealth && !health ? (
            <div className="space-y-2.5">
              {[0,1,2].map(i => <div key={i} className="h-11 rounded-[12px] animate-pulse" style={{ background: 'var(--color-surface-2)' }} />)}
            </div>
          ) : health && health.services.length > 0 ? (
            <div className="space-y-2">
              {health.services.map(svc => {
                const cfg = OVERALL[svc.status]
                return (
                  <div key={svc.name} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5"
                    style={{ background: 'var(--color-surface-0)' }}>
                    <cfg.Icon size={15} style={{ color: cfg.color }} strokeWidth={2.2} className="shrink-0" />
                    <span className="text-[13px] text-[var(--color-text-1)] flex-1 truncate">{svc.name}</span>
                    {svc.latencyMs !== undefined && (
                      <span className="text-[10px] font-mono text-[var(--color-text-3)]">{svc.latencyMs}ms</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--color-text-3)] py-4 text-center">Keine Health-Daten verfügbar.</p>
          )}
        </div>

        {/* Activity */}
        <div className="lg:col-span-3 rounded-[18px] border p-5"
          style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-3)]">Aktuelle Aktivität</h2>
            <a href="/dashboard/activity" className="flex items-center gap-1 text-[11px] text-[var(--color-brand)] hover:opacity-70 transition-opacity">
              Alle <ArrowRight size={11} />
            </a>
          </div>
          <ActivityFeed limit={7} compact />
        </div>
      </div>

      {/* ── Quick Access ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-3)] mb-3">Schnellzugriff</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <QuickTile icon={Languages}   label="Translations" desc="Texte in DE / EN / AR"      href="/dashboard/translations" />
          <QuickTile icon={FolderKanban} label="Projects"    desc="Projektkarten & Hero"        href="/dashboard/projects" />
          <QuickTile icon={PenLine}     label="Thoughts"     desc="Blog-Posts schreiben"        href="/dashboard/thoughts" />
          <QuickTile icon={ScrollText}  label="Changelog"    desc="Releases dokumentieren"      href="/dashboard/changelog" />
          <QuickTile icon={Image}       label="Media"        desc="Bilder, CV, Dokumente"       href="/dashboard/media" />
          <QuickTile icon={ShieldAlert} label="Maintenance"  desc="Wartungs- & Notfall-Modus"   href="/dashboard/maintenance" />
          <QuickTile icon={Bot}         label="Bot Memory"   desc="AI-Twin System-Prompt"       href="/dashboard/bot-memory" />
          <QuickTile icon={MapPinned}   label="Roadmap"      desc="Roadmap-Einträge"            href="/dashboard/roadmap" />
          <QuickTile icon={Activity}    label="Activity Log" desc="Vollständige Historie"       href="/dashboard/activity" />
        </div>
      </div>
    </PageTransition>
  )
}
