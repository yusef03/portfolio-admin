/**
 * GET  /api/activity?limit=20&category=translations  → letzte Einträge
 * POST /api/activity                                 → neuen Eintrag schreiben
 *
 * Nur für eingeloggte User.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logActivity, getRecentActivity, type ActivityCategory, type ActivityStatus } from '@/lib/activity'

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

const VALID_CATEGORIES: ActivityCategory[] = [
  'translations', 'maintenance', 'projects', 'bot_memory',
  'media', 'roadmap', 'changelog', 'thoughts', 'auth', 'system',
]
const VALID_STATUSES: ActivityStatus[] = ['success', 'warning', 'error', 'info']

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 200)
  const categoryParam = searchParams.get('category')
  const category = categoryParam && VALID_CATEGORIES.includes(categoryParam as ActivityCategory)
    ? (categoryParam as ActivityCategory)
    : undefined

  const items = await getRecentActivity(limit, category)
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.action !== 'string' || typeof body.category !== 'string' || typeof body.status !== 'string') {
    return NextResponse.json({ error: 'action, category und status sind Pflicht' }, { status: 400 })
  }
  if (!VALID_CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: `Ungültige category. Erlaubt: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 })
  }
  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `Ungültiger status. Erlaubt: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  await logActivity({
    action: body.action,
    category: body.category,
    status: body.status,
    message: body.message,
    details: body.details,
    error: body.error,
  })

  return NextResponse.json({ ok: true })
}
