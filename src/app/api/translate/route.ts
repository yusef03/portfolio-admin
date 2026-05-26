/**
 * POST /api/translate
 *
 * Body: { text: string, targetLang: 'EN-GB' | 'AR' }
 *   ODER für beide auf einmal:
 * Body: { text: string, both: true }
 *
 * Response: { translated: string }
 *   ODER: { en: string, ar: string }
 *
 * Nur für eingeloggte User (Auth-Check via Supabase).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { translate, translateBoth } from '@/lib/deepl'

export async function POST(req: NextRequest) {
  // ─── Auth-Check ─────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  }

  // ─── Body parsen ────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => null)
  if (!body || typeof body.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'text fehlt oder leer' }, { status: 400 })
  }

  // ─── Übersetzen ─────────────────────────────────────────────────────────────
  try {
    if (body.both === true) {
      // Beide Sprachen auf einmal
      const result = await translateBoth(body.text)
      return NextResponse.json(result)
    }

    if (!body.targetLang) {
      return NextResponse.json({ error: 'targetLang fehlt (EN-GB oder AR)' }, { status: 400 })
    }

    const translated = await translate(body.text, body.targetLang)
    return NextResponse.json({ translated })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('[/api/translate]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
