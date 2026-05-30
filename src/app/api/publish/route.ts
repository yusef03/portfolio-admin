/**
 * POST /api/publish  → triggert GitHub Actions Workflow
 * GET  /api/publish  → gibt Status des letzten Runs zurück
 *
 * Query-Parameter:
 *   ?target=translations  (Standard)
 *   ?target=projects
 *
 * Nur für eingeloggte User.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { triggerPublish, getLastPublishStatus } from '@/lib/github'

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

type Target = 'translations' | 'projects' | 'roadmap' | 'thoughts'

function parseTarget(req: NextRequest): Target {
  const t = req.nextUrl.searchParams.get('target')
  if (t === 'projects') return 'projects'
  if (t === 'roadmap') return 'roadmap'
  if (t === 'thoughts') return 'thoughts'
  return 'translations'
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const target = parseTarget(req)
  const result = await triggerPublish(target)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const target = parseTarget(req)
  const status = await getLastPublishStatus(target)
  return NextResponse.json(status)
}
