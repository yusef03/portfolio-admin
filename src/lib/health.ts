/**
 * Health-Checks für alle Subsysteme.
 * Jeder Check returnt strukturierten Status — niemals throw.
 * Timeout pro Check: 5 Sekunden.
 */

import { createClient } from '@supabase/supabase-js'

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

export interface ServiceHealth {
  name: string
  status: ServiceStatus
  latencyMs?: number
  message?: string
  hint?: string
  detailsUrl?: string
  meta?: Record<string, unknown>
}

export interface SystemHealth {
  overall: ServiceStatus
  checkedAt: string
  services: ServiceHealth[]
}

const TIMEOUT_MS  = 5000
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'yusef03/BETAPortfolioBach'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Timeout')), ms)),
  ])
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T | null; ms: number; error?: string }> {
  const start = Date.now()
  try {
    const result = await withTimeout(fn())
    return { result, ms: Date.now() - start }
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e)
    return { result: null, ms: Date.now() - start, error }
  }
}

// ─── Checks ───────────────────────────────────────────────────────────────────

export async function checkSupabase(): Promise<ServiceHealth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return { name: 'Supabase', status: 'down', message: 'ENV-Vars fehlen', hint: 'NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY prüfen' }
  }

  const supa = createClient(url, key, { auth: { persistSession: false } })
  const { ms, error } = await timed(async () => {
    const { error } = await supa.from('settings').select('key', { head: true, count: 'exact' }).limit(1)
    if (error) throw new Error(error.message)
    return true
  })

  if (error) {
    return {
      name: 'Supabase',
      status: 'down',
      latencyMs: ms,
      message: error,
      hint: error.includes('permission denied')
        ? 'GRANTs fehlen — siehe aktuell/architektur.md'
        : 'Supabase Dashboard prüfen: https://supabase.com/dashboard/project/msfmugoazylvbqvyidlg',
    }
  }

  return {
    name: 'Supabase',
    status: ms > 1000 ? 'degraded' : 'healthy',
    latencyMs: ms,
    message: ms > 1000 ? 'Hohe Latenz' : undefined,
  }
}

export async function checkDeepL(): Promise<ServiceHealth> {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) {
    return { name: 'DeepL', status: 'down', message: 'API-Key fehlt', hint: 'DEEPL_API_KEY in .env.local + Vercel setzen' }
  }

  const baseUrl = apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'

  const { result, ms, error } = await timed(async () => {
    const res = await fetch(`${baseUrl}/v2/usage`, {
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<{ character_count: number; character_limit: number }>
  })

  if (error || !result) {
    return {
      name: 'DeepL',
      status: 'down',
      latencyMs: ms,
      message: error ?? 'Keine Antwort',
      hint: error?.includes('401') || error?.includes('403')
        ? 'API-Key ungültig oder abgelaufen — neuen Key auf deepl.com erstellen'
        : 'DeepL Status prüfen: https://www.deepl.com/api-contact',
    }
  }

  const used = result.character_count
  const limit = result.character_limit
  const pct = limit > 0 ? (used / limit) * 100 : 0

  return {
    name: 'DeepL',
    status: pct > 90 ? 'degraded' : 'healthy',
    latencyMs: ms,
    message: pct > 90 ? `Nur noch ${(100 - pct).toFixed(1)}% Restkontingent` : undefined,
    meta: { used, limit, percent: pct.toFixed(1) },
  }
}

export async function checkGitHub(): Promise<ServiceHealth> {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return { name: 'GitHub', status: 'down', message: 'GITHUB_TOKEN fehlt', hint: 'Fine-grained PAT erstellen und in Vercel Env-Vars setzen' }
  }

  const { result, ms, error } = await timed(async () => {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<{ resources: { core: { remaining: number; limit: number; reset: number } } }>
  })

  if (error || !result) {
    return {
      name: 'GitHub',
      status: 'down',
      latencyMs: ms,
      message: error ?? 'Keine Antwort',
      hint: error?.includes('401') ? 'Token ungültig oder abgelaufen — neuen PAT erstellen' : 'github.com/status prüfen',
    }
  }

  const { remaining, limit } = result.resources.core
  const pct = (remaining / limit) * 100

  return {
    name: 'GitHub',
    status: pct < 10 ? 'degraded' : 'healthy',
    latencyMs: ms,
    message: pct < 10 ? `Nur noch ${remaining} Requests übrig` : undefined,
    meta: { remaining, limit },
  }
}

export async function checkPortfolio(): Promise<ServiceHealth> {
  const { result, ms, error } = await timed(async () => {
    const res = await fetch('https://yusefbach.de', { method: 'HEAD' })
    return res.status
  })

  if (error || !result) {
    return {
      name: 'Portfolio',
      status: 'down',
      latencyMs: ms,
      message: error ?? 'Keine Antwort',
      hint: 'GitHub Pages Status prüfen: githubstatus.com',
      detailsUrl: 'https://yusefbach.de',
    }
  }

  if (result >= 500) {
    return { name: 'Portfolio', status: 'down', latencyMs: ms, message: `HTTP ${result}`, detailsUrl: 'https://yusefbach.de' }
  }

  return {
    name: 'Portfolio',
    status: ms > 1500 ? 'degraded' : 'healthy',
    latencyMs: ms,
    message: ms > 1500 ? 'Hohe Latenz' : undefined,
    meta: { httpStatus: result },
    detailsUrl: 'https://yusefbach.de',
  }
}

export async function checkMaintenanceMode(): Promise<ServiceHealth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { name: 'Maintenance', status: 'unknown' }

  const supa = createClient(url, key, { auth: { persistSession: false } })
  const { result, ms, error } = await timed(async () => {
    const { data, error } = await supa.from('settings').select('value').eq('key', 'maintenance_mode').single()
    if (error) throw new Error(error.message)
    return data?.value as { enabled: boolean; emergency: boolean; message?: string } | null
  })

  if (error || !result) {
    return { name: 'Maintenance', status: 'unknown', latencyMs: ms, message: error ?? 'Nicht lesbar' }
  }

  if (result.emergency) {
    return { name: 'Maintenance', status: 'degraded', latencyMs: ms, message: '🚨 NOTFALL-MODUS AKTIV', meta: result }
  }
  if (result.enabled) {
    return { name: 'Maintenance', status: 'degraded', latencyMs: ms, message: 'Wartungsmodus aktiv', meta: result }
  }
  return { name: 'Maintenance', status: 'healthy', latencyMs: ms, message: 'AUS' }
}

// Aktive Publish-Workflows. Translations laufen seit dem repo-first-Umbau NICHT
// mehr über einen Workflow (Direkt-Commit via /api/lang-files) und sind hier raus.
const PUBLISH_WORKFLOWS = ['publish-projects.yml', 'publish-roadmap.yml', 'publish-thoughts.yml'] as const

export async function checkLastPublish(): Promise<ServiceHealth> {
  const token = process.env.GITHUB_TOKEN
  if (!token) return { name: 'Letzter Publish', status: 'unknown', message: 'GITHUB_TOKEN fehlt' }

  type Run = { status: string; conclusion: string | null; html_url: string; created_at: string }

  // Letzten Run jedes aktiven Publish-Workflows holen, dann den neuesten nehmen.
  const { result, ms, error } = await timed(async () => {
    const runs = await Promise.all(
      PUBLISH_WORKFLOWS.map(async wf => {
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${wf}/runs?per_page=1`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
        )
        if (!res.ok) return null
        const json = await res.json() as { workflow_runs: Run[] }
        return json.workflow_runs[0] ?? null
      })
    )
    return runs.filter((r): r is Run => r !== null)
  })

  if (error || !result) {
    return { name: 'Letzter Publish', status: 'unknown', latencyMs: ms, message: error }
  }

  // Neuesten Run über alle Workflows hinweg wählen.
  const run = result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  if (!run) return { name: 'Letzter Publish', status: 'unknown', latencyMs: ms, message: 'Noch nie ausgeführt' }

  const minsAgo = Math.round((Date.now() - new Date(run.created_at).getTime()) / 60000)
  const ago = minsAgo < 60 ? `vor ${minsAgo} Min` : `vor ${Math.round(minsAgo / 60)} Std`

  if (run.status === 'completed') {
    return {
      name: 'Letzter Publish',
      status: run.conclusion === 'success' ? 'healthy' : 'down',
      latencyMs: ms,
      message: run.conclusion === 'success' ? `✓ ${ago}` : `✗ Fehler ${ago}`,
      detailsUrl: run.html_url,
    }
  }

  return {
    name: 'Letzter Publish',
    status: 'degraded',
    latencyMs: ms,
    message: `Läuft gerade (${ago} gestartet)`,
    detailsUrl: run.html_url,
  }
}

export async function checkStorageQuota(): Promise<ServiceHealth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return { name: 'Storage', status: 'unknown', message: 'ENV-Vars fehlen' }
  }

  const supa = createClient(url, key, { auth: { persistSession: false } })
  const buckets = ['project-images', 'documents', 'thoughts-media']

  const { result, ms, error } = await timed(async () => {
    let totalBytes = 0
    for (const bucket of buckets) {
      const { data } = await supa.storage.from(bucket).list('', { limit: 500 })
      if (data) {
        for (const f of data) {
          const size = (f.metadata as { size?: number } | null)?.size ?? 0
          totalBytes += size
        }
      }
    }
    return totalBytes
  })

  if (error || result === null) {
    return { name: 'Storage', status: 'unknown', latencyMs: ms, message: error ?? 'Nicht lesbar' }
  }

  const QUOTA_BYTES = 1_073_741_824 // 1 GB Free Tier
  const pct = (result / QUOTA_BYTES) * 100
  const usedMb = (result / 1024 / 1024).toFixed(1)

  return {
    name: 'Storage',
    status: pct > 95 ? 'down' : pct > 80 ? 'degraded' : 'healthy',
    latencyMs: ms,
    message: pct > 80 ? `${usedMb} MB / 1 GB (${pct.toFixed(1)}% belegt)` : undefined,
    meta: { usedBytes: result, quotaBytes: QUOTA_BYTES, percent: parseFloat(pct.toFixed(1)), usedMb: parseFloat(usedMb) },
    detailsUrl: 'https://admin.yusefbach.de/dashboard/media',
  }
}

// ─── Aggregator ───────────────────────────────────────────────────────────────

export async function checkAll(): Promise<SystemHealth> {
  const services = await Promise.all([
    checkSupabase(),
    checkDeepL(),
    checkGitHub(),
    checkPortfolio(),
    checkMaintenanceMode(),
    checkLastPublish(),
    checkStorageQuota(),
  ])

  // Overall = schlechtester Status
  const order: ServiceStatus[] = ['down', 'degraded', 'unknown', 'healthy']
  const overall = order.find(s => services.some(svc => svc.status === s)) ?? 'healthy'

  return {
    overall,
    checkedAt: new Date().toISOString(),
    services,
  }
}
