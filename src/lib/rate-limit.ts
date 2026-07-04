/**
 * Sehr simpler in-memory Sliding-Window Rate-Limiter.
 *
 * Für Vercel Serverless-Funktionen ist "in-memory" nicht global geteilt —
 * jede Instanz hat ihren eigenen Bucket. Das reicht als erste Bremse gegen
 * Missbrauch (jede Instanz limitiert einzeln), ist aber KEIN harter Schutz
 * gegen einen entschlossenen Angreifer der viele Instanzen anfährt.
 *
 * Für Prod empfiehlt sich später ein zentraler Store (Upstash Redis o.ä.).
 * Bis dahin: hier bleibt es leichtgewichtig.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetInMs: number
}

/**
 * Prüft und erhöht den Zähler für einen Bucket-Key.
 * @param key       eindeutiger Schlüssel (z.B. `translate:<ip>`)
 * @param limit     maximale Requests pro Fenster
 * @param windowMs  Fenster in Millisekunden
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, resetInMs: windowMs }
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetInMs: existing.resetAt - now }
  }

  existing.count += 1
  return { ok: true, remaining: limit - existing.count, resetInMs: existing.resetAt - now }
}

/**
 * Extrahiert die Client-IP aus Vercel-Headern (x-forwarded-for, x-real-ip).
 * Fallback: 'unknown' — dann greift der Rate-Limiter über alle unknown-Clients
 * gemeinsam, was ok ist (defensive default).
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const real = headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}
