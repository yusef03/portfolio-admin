/**
 * GET /api/media-manifest
 * Lädt media-manifest.json aus dem Ziel-Repo (GITHUB_REPO)
 * via GitHub Contents API (GITHUB_TOKEN erforderlich).
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getRepoConfig } from '@/lib/repo-config'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const FILE         = 'media-manifest.json'

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'Konfigurationsfehler' }, { status: 500 })

  try {
    const { fullName } = getRepoConfig()
    const res = await fetch(
      `https://api.github.com/repos/${fullName}/contents/${FILE}`,
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
        { error: 'Manifest noch nicht generiert' },
        { status: 404 }
      )
    }

    if (!res.ok) throw new Error(`GitHub ${res.status}`)

    const json = await res.json() as { content: string; encoding: string }
    const content = Buffer.from(json.content, 'base64').toString('utf-8')

    return new NextResponse(content, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[media-manifest GET]', err)
    return NextResponse.json({ error: 'Manifest nicht ladbar' }, { status: 500 })
  }
}
