/**
 * POST /api/translate
 *
 * Body: { text: string, targetLang: 'EN-GB' | 'AR' }
 *   ODER für beide auf einmal: { text: string, both: true }
 *
 * Nur für Admin.
 * Rate-Limit: 60 Übersetzungen pro Stunde (Schutz gegen DeepL-Quota-Ausleitung).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { translate, translateBoth } from '@/lib/deepl'

const MAX_TEXT_LENGTH = 5000

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const rl = rateLimit(`translate:${clientIp(req.headers)}`, 60, 60 * 60 * 1000)
  if (!rl.ok) return NextResponse.json({ error: 'Rate-Limit erreicht' }, { status: 429 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'text fehlt oder leer' }, { status: 400 })
  }
  if (body.text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: 'Text zu lang' }, { status: 413 })
  }

  try {
    if (body.both === true) {
      const result = await translateBoth(body.text)
      return NextResponse.json(result)
    }

    if (!body.targetLang) {
      return NextResponse.json({ error: 'targetLang fehlt' }, { status: 400 })
    }
    if (body.targetLang !== 'EN-GB' && body.targetLang !== 'AR') {
      return NextResponse.json({ error: 'Ungültige targetLang' }, { status: 400 })
    }

    const translated = await translate(body.text, body.targetLang)
    return NextResponse.json({ translated })
  } catch (err) {
    console.error('[translate POST]', err)
    return NextResponse.json({ error: 'Übersetzung fehlgeschlagen' }, { status: 500 })
  }
}
