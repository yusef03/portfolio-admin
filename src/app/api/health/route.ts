/**
 * GET /api/health
 * Aggregierter Gesundheits-Status aller Subsysteme.
 * Nur für Admin.
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { checkAll } from '@/lib/health'

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const health = await checkAll()
    return NextResponse.json(health)
  } catch (err) {
    console.error('[health GET]', err)
    return NextResponse.json({ error: 'Health-Check fehlgeschlagen' }, { status: 500 })
  }
}
