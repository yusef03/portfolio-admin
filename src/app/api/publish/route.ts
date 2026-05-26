/**
 * POST /api/publish  → triggert GitHub Actions Workflow
 * GET  /api/publish  → gibt Status des letzten Runs zurück
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

export async function POST(_req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const result = await triggerPublish()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export async function GET(_req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const status = await getLastPublishStatus()
  return NextResponse.json(status)
}
