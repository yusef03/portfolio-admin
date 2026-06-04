/**
 * GET  /api/lang-files
 *   Liest lang/de.json + lang/en.json + lang/ar.json aus dem
 *   BETAPortfolioBach-Repo via GitHub Contents API.
 *   Gibt eine flache Zeilen-Liste zurück:
 *   [{ key, de, en, ar }, ...]  — alphabetisch nach key.
 *
 * POST /api/lang-files
 *   Schreibt alle 3 lang-Dateien in einem Commit ins Repo.
 *   Body: { rows: Array<{ key, de, en, ar }>, message?: string }
 *   Reihenfolge: de → en → ar (sequenziell, jede Datei bekommt ihre eigene SHA)
 */

import { NextResponse }    from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies }         from 'next/headers'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO         = process.env.GITHUB_REPO ?? 'yusef03/BETAPortfolioBach'
const LANG_FILES   = ['lang/de.json', 'lang/en.json', 'lang/ar.json'] as const
type LangKey       = 'de' | 'en' | 'ar'

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ─── GitHub Helpers ───────────────────────────────────────────────────────────
const GH_HEADERS = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

async function fetchFileFromGitHub(path: string): Promise<{ content: Record<string, string>; sha: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    { headers: GH_HEADERS, cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`GitHub ${res.status} für ${path}`)
  const json = await res.json() as { content: string; sha: string }
  const decoded = Buffer.from(json.content, 'base64').toString('utf-8')
  return { content: JSON.parse(decoded), sha: json.sha }
}

async function commitFileToGitHub(
  path: string,
  content: Record<string, string>,
  sha: string,
  message: string
): Promise<void> {
  const encoded = Buffer.from(JSON.stringify(content, null, 2) + '\n').toString('base64')
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...GH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: encoded,
        sha,
        committer: { name: 'Yusef Bach', email: 'kontakt@yusefbach.de' },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json() as { message?: string }
    throw new Error(err.message ?? `GitHub PUT ${res.status} für ${path}`)
  }
}

// ─── GET: alle 3 lang-Dateien lesen und als Zeilen-Liste zurückgeben ──────────
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'GITHUB_TOKEN fehlt' }, { status: 500 })

  try {
    const [de, en, ar] = await Promise.all(
      LANG_FILES.map(f => fetchFileFromGitHub(f))
    )

    // Alle Keys (Union aller drei Dateien, alphabetisch)
    const allKeys = [...new Set([
      ...Object.keys(de.content),
      ...Object.keys(en.content),
      ...Object.keys(ar.content),
    ])].sort()

    const rows = allKeys.map(key => ({
      key,
      de: de.content[key] ?? '',
      en: en.content[key] ?? '',
      ar: ar.content[key] ?? '',
    }))

    return NextResponse.json({ rows, totalKeys: rows.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── POST: alle 3 lang-Dateien committen ──────────────────────────────────────
export async function POST(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'GITHUB_TOKEN fehlt' }, { status: 500 })

  let body: { rows: Array<{ key: string; de: string; en: string; ar: string }>; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const { rows, message = 'chore: Translations aktualisiert via Admin Panel' } = body
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows fehlt oder leer' }, { status: 400 })
  }

  // Objekte aufbauen (alphabetisch sortiert = konsistente Diffs)
  const sortedRows = [...rows].sort((a, b) => a.key.localeCompare(b.key))
  const objects: Record<LangKey, Record<string, string>> = { de: {}, en: {}, ar: {} }
  for (const row of sortedRows) {
    objects.de[row.key] = row.de
    objects.en[row.key] = row.en
    objects.ar[row.key] = row.ar
  }

  try {
    // Aktuelle SHAs aller 3 Dateien gleichzeitig laden
    const [deSha, enSha, arSha] = await Promise.all(
      LANG_FILES.map(async f => (await fetchFileFromGitHub(f)).sha)
    )

    // Sequenziell committen — jede Datei unabhängig, eigene SHA
    // (jedes PUT erzeugt einen eigenen Commit; SHAs der anderen Dateien ändern sich dabei nicht)
    await commitFileToGitHub('lang/de.json', objects.de, deSha, message)
    await commitFileToGitHub('lang/en.json', objects.en, enSha, message)
    await commitFileToGitHub('lang/ar.json', objects.ar, arSha, message)

    return NextResponse.json({ ok: true, committedKeys: rows.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
