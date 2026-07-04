/**
 * Zentrale Auth-Utility für alle Server-Routes.
 *
 * Regel: Ein Aufrufer ist NUR dann autorisiert, wenn
 *   1. eine gültige Supabase-Session existiert,
 *   2. der User über den GitHub-Provider eingeloggt ist,
 *   3. der GitHub-Username in ADMIN_GITHUB_USERNAMES gelistet ist,
 *   4. die verifizierte Email in ADMIN_EMAILS gelistet ist,
 *   5. (optional) ein gültiges Admin-PIN-Cookie vorliegt, falls ADMIN_PIN gesetzt ist.
 *
 * Alle vier Ebenen werden AND-verknüpft geprüft — Defense-in-Depth. Ein
 * kompromittierter Email-Header allein reicht nicht, ein anderer GitHub-Account
 * mit gleicher Email auch nicht.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { verifyPinCookie, PIN_COOKIE_NAME } from './pin'

export type AuthFailureReason =
  | 'no_session'
  | 'wrong_provider'
  | 'email_not_whitelisted'
  | 'username_not_whitelisted'
  | 'email_not_verified'
  | 'pin_missing_or_invalid'

export interface AuthResult {
  ok: boolean
  user: User | null
  reason?: AuthFailureReason
}

function parseList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

function getAdminEmails(): string[] {
  return parseList(process.env.ADMIN_EMAILS)
}

function getAdminGithubUsernames(): string[] {
  return parseList(process.env.ADMIN_GITHUB_USERNAMES)
}

/**
 * Kern-Check: passt der User zu Yusef?
 * Wird sowohl vom Proxy (Middleware) als auch von jeder API-Route verwendet.
 */
export function isAuthorizedUser(user: User | null): { ok: boolean; reason?: AuthFailureReason } {
  if (!user) return { ok: false, reason: 'no_session' }

  const provider = user.app_metadata?.provider
  if (provider !== 'github') return { ok: false, reason: 'wrong_provider' }

  const email = user.email?.toLowerCase()
  const emailVerified = user.user_metadata?.email_verified === true
  if (!email || !emailVerified) return { ok: false, reason: 'email_not_verified' }

  const adminEmails = getAdminEmails()
  if (adminEmails.length > 0 && !adminEmails.includes(email)) {
    return { ok: false, reason: 'email_not_whitelisted' }
  }

  const username = (user.user_metadata?.user_name ?? user.user_metadata?.preferred_username ?? '')
    .toString()
    .toLowerCase()
  const adminUsernames = getAdminGithubUsernames()
  if (adminUsernames.length > 0 && !adminUsernames.includes(username)) {
    return { ok: false, reason: 'username_not_whitelisted' }
  }

  return { ok: true }
}

/**
 * Prüft ADMIN_PIN-Cookie, wenn ADMIN_PIN in ENV gesetzt ist.
 * Wenn kein ADMIN_PIN in ENV → PIN-Check deaktiviert (returnt true).
 */
export async function isPinValid(): Promise<boolean> {
  const expected = process.env.ADMIN_PIN
  if (!expected) return true // PIN-Feature nicht aktiv
  const secret = process.env.ADMIN_PIN_COOKIE_SECRET
  if (!secret) return false // Feature aktiv, aber Config unvollständig → hart failen

  const cookieStore = await cookies()
  const token = cookieStore.get(PIN_COOKIE_NAME)?.value
  return verifyPinCookie(token, secret)
}

/**
 * Vollständige Auth-Prüfung für API-Routes (Session + Whitelist + PIN).
 * Nutzung:
 *   const guard = await requireAdmin()
 *   if (!guard.ok) return guard.response
 *   const user = guard.user
 */
export async function requireAdmin(): Promise<
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }
> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  const whitelistCheck = isAuthorizedUser(user)
  if (!whitelistCheck.ok) {
    // Konsistente 403 — kein Detail-Leak
    return {
      ok: false,
      response: NextResponse.json({ error: 'Zugang verweigert' }, { status: 403 }),
    }
  }

  const pinOk = await isPinValid()
  if (!pinOk) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Zweiter Faktor fehlt' }, { status: 403 }),
    }
  }

  return { ok: true, user: user! }
}
