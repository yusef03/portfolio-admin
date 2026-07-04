/**
 * Admin-PIN als zweiter Faktor nach GitHub-OAuth.
 *
 * Nach erfolgreichem OAuth-Login wird der User auf /verify-pin geleitet.
 * Dort gibt er den PIN ein; bei Match wird ein HMAC-signiertes Cookie gesetzt,
 * das die Middleware (proxy) und alle API-Routes bei jedem Request prüfen.
 *
 * Design:
 * - Konstante Zeit bei Vergleich (timingSafeEqual) → keine Timing-Attacks.
 * - HMAC-SHA256 mit ADMIN_PIN_COOKIE_SECRET → Cookie kann nicht gefälscht werden.
 * - Ablaufzeit im Payload, ebenfalls signiert.
 * - Cookie: HttpOnly, Secure, SameSite=Lax, Path=/
 */

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'

export const PIN_COOKIE_NAME = 'admin_pin_v1'
export const PIN_COOKIE_MAX_AGE_S = 60 * 60 * 8 // 8 Stunden

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export function comparePinConstantTime(actual: string, expected: string): boolean {
  // Auf gleiche Länge bringen, um Längen-Leak zu vermeiden
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  const len = Math.max(a.length, b.length)
  const pa = Buffer.alloc(len)
  const pb = Buffer.alloc(len)
  a.copy(pa)
  b.copy(pb)
  const equal = timingSafeEqual(pa, pb)
  return equal && a.length === b.length
}

/**
 * Erzeugt einen signierten PIN-Cookie-Wert.
 * Format: <expiresAtSec>.<nonce>.<hmac>
 */
export function issuePinCookie(secret: string, ttlSeconds = PIN_COOKIE_MAX_AGE_S): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds
  const nonce = randomBytes(16).toString('base64url')
  const payload = `${expiresAt}.${nonce}`
  const sig = sign(payload, secret)
  return `${payload}.${sig}`
}

/**
 * Verifiziert einen PIN-Cookie-Wert.
 * Return: true, wenn Signatur gültig UND nicht abgelaufen.
 */
export function verifyPinCookie(token: string | undefined | null, secret: string): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [expiresAtStr, nonce, sig] = parts
  const expiresAt = parseInt(expiresAtStr, 10)
  if (!Number.isFinite(expiresAt)) return false
  if (Math.floor(Date.now() / 1000) > expiresAt) return false

  const expectedSig = sign(`${expiresAtStr}.${nonce}`, secret)
  return safeEqual(sig, expectedSig)
}
