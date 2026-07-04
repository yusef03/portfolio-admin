/**
 * GET  /api/lang-files
 *   Liest lang/de.json + lang/en.json + lang/ar.json aus dem Repo.
 *
 * POST /api/lang-files
 *   Schreibt alle 3 lang-Dateien in 3 sequenziellen Commits ins Repo.
 *   Body: { rows: Array<{ key, de, en, ar }>, message?: string }
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { getRepoConfig } from '@/lib/repo-config'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const LANG_FILES   = ['lang/de.json', 'lang/en.json', 'lang/ar.json'] as const
type LangKey       = 'de' | 'en' | 'ar'

const MAX_ROWS = 5000
const MAX_KEY_LENGTH = 200
const MAX_VALUE_LENGTH = 10_000

const GH_HEADERS = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

async function fetchFileFromGitHub(path: string): Promise<{ content: Record<string, string>; sha: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${getRepoConfig().fullName}/contents/${path}`,
    { headers: GH_HEADERS, cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
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
    `https://api.github.com/repos/${getRepoConfig().fullName}/contents/${path}`,
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
  if (!res.ok) throw new Error(`GitHub PUT ${res.status}`)
}

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'Konfigurationsfehler' }, { status: 500 })

  try {
    const [de, en, ar] = await Promise.all(
      LANG_FILES.map(f => fetchFileFromGitHub(f))
    )

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
  } catch (err) {
    console.error('[lang-files GET]', err)
    return NextResponse.json({ error: 'Laden fehlgeschlagen' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'Konfigurationsfehler' }, { status: 500 })

  const rl = rateLimit(`lang-files:${clientIp(req.headers)}`, 20, 60 * 60 * 1000)
  if (!rl.ok) return NextResponse.json({ error: 'Rate-Limit erreicht' }, { status: 429 })

  let body: { rows: Array<{ key: string; de: string; en: string; ar: string }>; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }

  const { rows, message = 'chore: Translations aktualisiert via Admin Panel' } = body
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows fehlt' }, { status: 400 })
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: 'zu viele rows' }, { status: 413 })
  }
  if (typeof message !== 'string' || message.length > 300) {
    return NextResponse.json({ error: 'message ungültig' }, { status: 400 })
  }
  for (const r of rows) {
    if (!r || typeof r.key !== 'string' || r.key.length === 0 || r.key.length > MAX_KEY_LENGTH) {
      return NextResponse.json({ error: 'key ungültig' }, { status: 400 })
    }
    for (const lang of ['de', 'en', 'ar'] as const) {
      const v = r[lang]
      if (typeof v !== 'string' || v.length > MAX_VALUE_LENGTH) {
        return NextResponse.json({ error: `Wert ungültig (${lang})` }, { status: 400 })
      }
    }
  }

  const sortedRows = [...rows].sort((a, b) => a.key.localeCompare(b.key))
  const objects: Record<LangKey, Record<string, string>> = { de: {}, en: {}, ar: {} }
  for (const row of sortedRows) {
    objects.de[row.key] = row.de
    objects.en[row.key] = row.en
    objects.ar[row.key] = row.ar
  }

  try {
    const [deSha, enSha, arSha] = await Promise.all(
      LANG_FILES.map(async f => (await fetchFileFromGitHub(f)).sha)
    )

    await commitFileToGitHub('lang/de.json', objects.de, deSha, message)
    await commitFileToGitHub('lang/en.json', objects.en, enSha, message)
    await commitFileToGitHub('lang/ar.json', objects.ar, arSha, message)

    return NextResponse.json({ ok: true, committedKeys: rows.length })
  } catch (err) {
    console.error('[lang-files POST]', err)
    return NextResponse.json({ error: 'Commit fehlgeschlagen' }, { status: 500 })
  }
}
