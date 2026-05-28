/**
 * GET /api/media-manifest
 * Lädt media-manifest.json aus dem privaten BETAPortfolioBach-Repo
 * via GitHub Contents API (GITHUB_TOKEN erforderlich).
 * Gibt das JSON direkt weiter — kein Caching, immer aktuell.
 */

import { NextResponse }    from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies }         from 'next/headers'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO         = process.env.GITHUB_REPO ?? 'yusef03/BETAPortfolioBach'
const FILE         = 'media-manifest.json'

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

export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_TOKEN fehlt' }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        cache: 'no-store',
      }
    )

    if (res.status === 404) {
      return NextResponse.json(
        { error: 'Manifest noch nicht generiert. Bitte lokal ausführen: node scripts/build-media-manifest.mjs' },
        { status: 404 }
      )
    }

    if (!res.ok) {
      throw new Error(`GitHub API: HTTP ${res.status}`)
    }

    const json = await res.json() as { content: string; encoding: string }
    const content = Buffer.from(json.content, 'base64').toString('utf-8')

    return new NextResponse(content, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Manifest-Fetch fehlgeschlagen: ${message}` }, { status: 500 })
  }
}
