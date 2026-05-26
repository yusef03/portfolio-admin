/**
 * Activity Log Helper
 * Schreibt strukturierte Einträge in die activity_log Tabelle.
 *
 * Verwendung (Server-side, z.B. in API Routes):
 *   await logActivity({
 *     action: 'translation_updated',
 *     category: 'translations',
 *     status: 'success',
 *     message: 'Hero-Text auf Deutsch geändert',
 *     details: { key: 'hero_text', field: 'de' }
 *   })
 *
 * NIE Passwörter, API-Keys, Tokens in `details` loggen.
 * Bei eigenem Fehler: silent fail (console.error), nie Endlosschleife.
 */

import { createClient } from '@supabase/supabase-js'

export type ActivityStatus = 'success' | 'warning' | 'error' | 'info'

export type ActivityCategory =
  | 'translations'
  | 'maintenance'
  | 'projects'
  | 'bot_memory'
  | 'media'
  | 'roadmap'
  | 'changelog'
  | 'thoughts'
  | 'auth'
  | 'system'

export interface ActivityLogInput {
  action: string
  category: ActivityCategory
  status: ActivityStatus
  message?: string
  details?: Record<string, unknown>
  error?: string
}

/**
 * Schreibt einen Eintrag ins activity_log.
 * Failt silent — niemals selbst eine Exception werfen die den Aufrufer crasht.
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      console.error('[activity] Supabase ENV vars fehlen — skip log')
      return
    }

    const supa = createClient(url, key, { auth: { persistSession: false } })

    const { error } = await supa.from('activity_log').insert({
      action: input.action,
      category: input.category,
      status: input.status,
      message: input.message ?? null,
      details: input.details ?? {},
      error: input.error ?? null,
    })

    if (error) {
      console.error('[activity] Insert fehlgeschlagen:', error.message)
    }
  } catch (e: unknown) {
    // Defensive: alle möglichen Fehler abfangen, nie weitergeben
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[activity] Unerwarteter Fehler:', msg)
  }
}

/**
 * Liest die letzten N Activity-Einträge.
 */
export async function getRecentActivity(
  limit = 20,
  category?: ActivityCategory
): Promise<Array<{
  id: string
  action: string
  category: string
  status: ActivityStatus
  message: string | null
  details: Record<string, unknown>
  error: string | null
  created_at: string
}>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []

  const supa = createClient(url, key, { auth: { persistSession: false } })

  let query = supa
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) {
    console.error('[activity] Fetch fehlgeschlagen:', error.message)
    return []
  }
  return data ?? []
}
