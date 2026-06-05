/**
 * POST /api/publish  → triggert GitHub Actions Workflow
 * GET  /api/publish  → gibt Status des letzten Runs zurück
 *
 * Query-Parameter (Pflicht):
 *   ?target=projects
 *   ?target=roadmap
 *   ?target=thoughts
 *
 * Hinweis: Translations laufen seit dem repo-first-Umbau NICHT mehr über einen
 * publish-Workflow, sondern committen direkt via /api/lang-files.
 *
 * Nur für eingeloggte User.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { triggerPublish, getLastPublishStatus, type PublishTarget } from '@/lib/github'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

const VALID_TARGETS: readonly PublishTarget[] = ['projects', 'roadmap', 'thoughts']

function parseTarget(req: NextRequest): PublishTarget | null {
  const t = req.nextUrl.searchParams.get('target')
  return VALID_TARGETS.includes(t as PublishTarget) ? (t as PublishTarget) : null
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const target = parseTarget(req)
  if (!target) return NextResponse.json({ error: 'Unbekanntes oder fehlendes target (erlaubt: projects, roadmap, thoughts)' }, { status: 400 })

  const result = await triggerPublish(target)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const target = parseTarget(req)
  if (!target) return NextResponse.json({ error: 'Unbekanntes oder fehlendes target (erlaubt: projects, roadmap, thoughts)' }, { status: 400 })

  const status = await getLastPublishStatus(target)
  return NextResponse.json(status)
}
