/**
 * POST /api/verify-pin
 * Body: { pin: string }
 *
 * Prüft den eingegebenen PIN gegen ADMIN_PIN und setzt bei Erfolg ein
 * HMAC-signiertes HttpOnly-Cookie.
 *
 * Bedingung: die Supabase-Session MUSS bereits gültig und whitelisted sein
 * (sonst kommt der Aufruf gar nicht erst durch, weil der Proxy `/api/*` schützt —
 * ABER: der Proxy lässt `/api/verify-pin` nicht durch, wenn Pin-Cookie fehlt.
 * Also müssen wir hier eine eigene Ausnahme haben: Session-Check ja, Pin-Check nein.)
 *
 * Weil der Proxy `/api/*` mit PIN-Gate schützt, muss `/api/verify-pin` in einer
 * Whitelist ausgenommen sein — das läuft über eine Sonderprüfung im Proxy.
 * Hier prüfen wir nur: Session + Whitelist + Rate-Limit + PIN-Match.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isAuthorizedUser } from '@/lib/auth'
import { comparePinConstantTime, issuePinCookie, PIN_COOKIE_NAME, PIN_COOKIE_MAX_AGE_S } from '@/lib/pin'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export async function POST(req: Request) {
  // ── Rate-Limit: 5 Versuche pro 15 Min pro IP ─────────────────────────────
  const ip = clientIp(req.headers)
  const rl = rateLimit(`verify-pin:${ip}`, 5, 15 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Zu viele Versuche' }, { status: 429 })
  }

  // ── Session + Whitelist ──────────────────────────────────────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const check = isAuthorizedUser(user)
  if (!check.ok) {
    return NextResponse.json({ error: 'Zugang verweigert' }, { status: 403 })
  }

  // ── Body + PIN-Check ─────────────────────────────────────────────────────
  const expected = process.env.ADMIN_PIN
  const secret = process.env.ADMIN_PIN_COOKIE_SECRET
  if (!expected || !secret) {
    // Feature nicht aktiviert oder falsch konfiguriert → generisch failen
    return NextResponse.json({ error: 'PIN nicht konfiguriert' }, { status: 500 })
  }

  let body: { pin?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }
  const submitted = (body.pin ?? '').toString()
  if (!submitted) {
    return NextResponse.json({ error: 'PIN fehlt' }, { status: 400 })
  }

  if (!comparePinConstantTime(submitted, expected)) {
    return NextResponse.json({ error: 'Falscher PIN' }, { status: 401 })
  }

  // ── Cookie setzen ────────────────────────────────────────────────────────
  const token = issuePinCookie(secret)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(PIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PIN_COOKIE_MAX_AGE_S,
  })
  return res
}
