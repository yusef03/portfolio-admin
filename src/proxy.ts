/**
 * Next.js 16 Proxy (früher middleware.ts).
 *
 * Zweistufiger Gate für /dashboard und /api:
 *  1. Supabase-Session vorhanden + User in Whitelist (Email + GitHub-Username).
 *  2. Optional: Admin-PIN-Cookie gültig, wenn ADMIN_PIN gesetzt ist.
 *
 * Ist Stufe 1 verletzt → sofortiger signOut + Redirect zu /login?error=<reason>.
 * Ist Stufe 2 verletzt → Redirect zu /verify-pin (Session bleibt).
 *
 * Rate-Limit-Header werden hier nicht gesetzt; das läuft in den Routes selbst.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedUser } from '@/lib/auth'
import { verifyPinCookie, PIN_COOKIE_NAME } from '@/lib/pin'

const PUBLIC_PATHS = new Set<string>(['/login', '/auth/callback', '/verify-pin'])

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  // Public assets (favicon, next static)
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico' || pathname.startsWith('/yb-')) {
    return true
  }
  return false
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let proxyResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          proxyResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            proxyResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const auth = isAuthorizedUser(user)

  // ── Login-Seite: Wenn schon voll auth+PIN → weiter ins Dashboard
  if (pathname === '/login') {
    if (auth.ok && pinOkFromRequest(request)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return proxyResponse
  }

  // ── /verify-pin: Nur zulassen, wenn Session+Whitelist ok
  if (pathname === '/verify-pin') {
    if (!auth.ok) {
      // Fremder ohne gültige Session → weg
      return redirectToLogin(request, auth.reason ?? 'no_session', proxyResponse)
    }
    // Wenn PIN schon gültig → weiter ins Dashboard
    if (pinOkFromRequest(request)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return proxyResponse
  }

  // ── Öffentliche Pfade (auth/callback, static)
  if (isPublic(pathname)) return proxyResponse

  // ── Ab hier: geschützte Bereiche (/dashboard, /api/*)
  // Session/Whitelist muss ok sein
  if (!auth.ok) {
    // Session lokal löschen, damit stale Cookies nicht ewig herumhängen
    await supabase.auth.signOut().catch(() => {})
    // Bei API-Requests JSON zurückgeben, sonst Redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Zugang verweigert' }, { status: 403 })
    }
    return redirectToLogin(request, auth.reason ?? 'no_session', proxyResponse)
  }

  // PIN-Check (falls Feature aktiv)
  // Ausnahme: /api/verify-pin selbst — dort SETZT der User den PIN erst.
  const isPinSetupRoute = pathname === '/api/verify-pin'
  if (!isPinSetupRoute && !pinOkFromRequest(request)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Zweiter Faktor fehlt' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/verify-pin', request.url))
  }

  return proxyResponse
}

function pinOkFromRequest(request: NextRequest): boolean {
  const secret = process.env.ADMIN_PIN_COOKIE_SECRET
  const pin = process.env.ADMIN_PIN
  if (!pin) return true // Feature nicht aktiv
  if (!secret) return false // Feature aktiv, Config unvollständig
  const token = request.cookies.get(PIN_COOKIE_NAME)?.value
  return verifyPinCookie(token, secret)
}

function redirectToLogin(request: NextRequest, reason: string, base: NextResponse): NextResponse {
  const url = new URL('/login', request.url)
  url.searchParams.set('error', reason)
  const res = NextResponse.redirect(url)
  // Cookies aus base übernehmen (Supabase set-cookies aus dem Refresh-Flow)
  base.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value, c))
  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*',
    '/login',
    '/verify-pin',
  ],
}
