/**
 * POST /api/publish  → triggert GitHub Actions Workflow
 * GET  /api/publish  → gibt Status des letzten Runs zurück
 *
 * Query-Parameter (Pflicht):
 *   ?target=projects
 *   ?target=roadmap
 *   ?target=thoughts
 *
 * Nur für Admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { triggerPublish, getLastPublishStatus, type PublishTarget } from '@/lib/github'

const VALID_TARGETS: readonly PublishTarget[] = ['projects', 'roadmap', 'thoughts']

function parseTarget(req: NextRequest): PublishTarget | null {
  const t = req.nextUrl.searchParams.get('target')
  return VALID_TARGETS.includes(t as PublishTarget) ? (t as PublishTarget) : null
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const rl = rateLimit(`publish:${clientIp(req.headers)}`, 20, 60 * 60 * 1000)
  if (!rl.ok) return NextResponse.json({ error: 'Rate-Limit erreicht' }, { status: 429 })

  const target = parseTarget(req)
  if (!target) return NextResponse.json({ error: 'Ungültiges target' }, { status: 400 })

  try {
    const result = await triggerPublish(target)
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (err) {
    console.error('[publish POST]', err)
    return NextResponse.json({ error: 'Publish fehlgeschlagen' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const target = parseTarget(req)
  if (!target) return NextResponse.json({ error: 'Ungültiges target' }, { status: 400 })

  try {
    const status = await getLastPublishStatus(target)
    return NextResponse.json(status)
  } catch (err) {
    console.error('[publish GET]', err)
    return NextResponse.json({ error: 'Status nicht verfügbar' }, { status: 500 })
  }
}
