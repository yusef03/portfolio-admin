/**
 * GET  /api/bot-memory
 *   Liest api/yusef_brain.md aus dem BETAPortfolioBach-Repo via GitHub Contents API.
 *   Gibt { content: string, sha: string } zurück.
 *
 * POST /api/bot-memory
 *   Committet neuen Inhalt nach api/yusef_brain.md ins Repo.
 *   Body: { content: string, sha: string, message?: string }
 *   → Vercel deployt das Bot-Backend automatisch neu (~1-2 Min)
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { getRepoConfig } from '@/lib/repo-config'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const FILE_PATH    = 'api/yusef_brain.md'

const GH_HEADERS = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

const MAX_CONTENT_BYTES = 200_000 // 200 KB Schutz gegen absurde Payloads

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'Konfigurationsfehler' }, { status: 500 })

  try {
    const { fullName } = getRepoConfig()
    const res = await fetch(
      `https://api.github.com/repos/${fullName}/contents/${FILE_PATH}`,
      { headers: GH_HEADERS, cache: 'no-store' }
    )
    if (!res.ok) throw new Error(`GitHub ${res.status}`)
    const json = await res.json() as { content: string; sha: string }
    const content = Buffer.from(json.content, 'base64').toString('utf-8')
    return NextResponse.json({ content, sha: json.sha })
  } catch (err) {
    console.error('[bot-memory GET]', err)
    return NextResponse.json({ error: 'Laden fehlgeschlagen' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'Konfigurationsfehler' }, { status: 500 })

  // Rate-Limit: max 20 Commits pro Stunde pro IP
  const rl = rateLimit(`bot-memory:${clientIp(req.headers)}`, 20, 60 * 60 * 1000)
  if (!rl.ok) return NextResponse.json({ error: 'Rate-Limit erreicht' }, { status: 429 })

  let body: { content: string; sha: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }

  const { content, sha, message = 'content: Bot Memory aktualisiert via Admin Panel' } = body
  if (typeof content !== 'string' || typeof sha !== 'string' || !content || !sha) {
    return NextResponse.json({ error: 'content und sha sind Pflicht' }, { status: 400 })
  }
  if (Buffer.byteLength(content, 'utf-8') > MAX_CONTENT_BYTES) {
    return NextResponse.json({ error: 'Inhalt zu groß' }, { status: 413 })
  }
  if (typeof message !== 'string' || message.length > 300) {
    return NextResponse.json({ error: 'message ungültig' }, { status: 400 })
  }

  try {
    const { fullName } = getRepoConfig()
    const encoded = Buffer.from(content).toString('base64')
    const res = await fetch(
      `https://api.github.com/repos/${fullName}/contents/${FILE_PATH}`,
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
    const result = await res.json() as { content?: { sha?: string } }
    return NextResponse.json({ ok: true, sha: result.content?.sha ?? '' })
  } catch (err) {
    console.error('[bot-memory POST]', err)
    return NextResponse.json({ error: 'Commit fehlgeschlagen' }, { status: 500 })
  }
}
