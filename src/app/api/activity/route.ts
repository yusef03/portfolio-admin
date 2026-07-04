/**
 * GET  /api/activity?limit=20&category=translations
 * POST /api/activity  → neuen Eintrag ins activity_log
 *
 * Nur für Admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logActivity, getRecentActivity, type ActivityCategory, type ActivityStatus } from '@/lib/activity'

const VALID_CATEGORIES: ActivityCategory[] = [
  'translations', 'maintenance', 'projects', 'bot_memory',
  'media', 'roadmap', 'changelog', 'thoughts', 'auth', 'system',
]
const VALID_STATUSES: ActivityStatus[] = ['success', 'warning', 'error', 'info']

const MAX_ACTION_LEN = 200
const MAX_MESSAGE_LEN = 2000
const MAX_ERROR_LEN = 2000

export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 200)
  const categoryParam = searchParams.get('category')
  const category = categoryParam && VALID_CATEGORIES.includes(categoryParam as ActivityCategory)
    ? (categoryParam as ActivityCategory)
    : undefined

  try {
    const items = await getRecentActivity(limit, category)
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[activity GET]', err)
    return NextResponse.json({ error: 'Nicht abrufbar' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => null)
  if (!body || typeof body.action !== 'string' || typeof body.category !== 'string' || typeof body.status !== 'string') {
    return NextResponse.json({ error: 'action, category und status sind Pflicht' }, { status: 400 })
  }
  if (body.action.length > MAX_ACTION_LEN) {
    return NextResponse.json({ error: 'action zu lang' }, { status: 400 })
  }
  if (!VALID_CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: 'Ungültige category' }, { status: 400 })
  }
  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Ungültiger status' }, { status: 400 })
  }
  if (body.message !== undefined && (typeof body.message !== 'string' || body.message.length > MAX_MESSAGE_LEN)) {
    return NextResponse.json({ error: 'message ungültig' }, { status: 400 })
  }
  if (body.error !== undefined && (typeof body.error !== 'string' || body.error.length > MAX_ERROR_LEN)) {
    return NextResponse.json({ error: 'error ungültig' }, { status: 400 })
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
