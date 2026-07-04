/**
 * POST /api/repo-commit
 * Committet eine Datei (und optional einen WebP-Partner) ins Portfolio-Repo
 * via GitHub Contents API. Erfordert Admin-Auth + GITHUB_TOKEN mit contents:write.
 * FormData: path (Repo-Pfad), file (Datei), optional: webpPath, webpFile
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { getRepoConfig } from '@/lib/repo-config'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN

const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB
const ALLOWED_EXT = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico',
  'pdf', 'md', 'json', 'txt',
])

function isSafeRepoPath(p: string): boolean {
  if (!p || p.length > 300) return false
  if (p.startsWith('/') || p.includes('..') || p.includes('\\')) return false
  if (!/^[a-zA-Z0-9._\-\/]+$/.test(p)) return false
  const ext = p.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_EXT.has(ext)
}

async function getFileSha(repoFullName: string, path: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${repoFullName}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )
  if (!res.ok) return null
  const data = await res.json() as { sha?: string }
  return data.sha ?? null
}

async function commitFile(
  repoFullName: string,
  path: string,
  content: Buffer,
  sha: string | null,
  message: string
): Promise<string> {
  const body: Record<string, unknown> = {
    message,
    content: content.toString('base64'),
    committer: { name: 'Yusef Bach', email: 'kontakt@yusefbach.de' },
  }
  if (sha) body.sha = sha

  const res = await fetch(
    `https://api.github.com/repos/${repoFullName}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) throw new Error(`GitHub PUT ${res.status}`)

  const data = await res.json() as { commit: { html_url: string } }
  return data.commit.html_url
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'Konfigurationsfehler' }, { status: 500 })

  const rl = rateLimit(`repo-commit:${clientIp(req.headers)}`, 30, 60 * 60 * 1000)
  if (!rl.ok) return NextResponse.json({ error: 'Rate-Limit erreicht' }, { status: 429 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }

  const path     = formData.get('path') as string | null
  const file     = formData.get('file') as File | null
  const webpPath = formData.get('webpPath') as string | null
  const webpFile = formData.get('webpFile') as File | null

  if (!path || !file) {
    return NextResponse.json({ error: 'path und file sind erforderlich' }, { status: 400 })
  }
  if (!isSafeRepoPath(path)) {
    return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Datei zu groß' }, { status: 413 })
  }
  if (webpPath && !isSafeRepoPath(webpPath)) {
    return NextResponse.json({ error: 'Ungültiger WebP-Pfad' }, { status: 400 })
  }
  if (webpFile && webpFile.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'WebP zu groß' }, { status: 413 })
  }

  try {
    const { fullName } = getRepoConfig()
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const sha        = await getFileSha(fullName, path)
    const commitUrl  = await commitFile(fullName, path, fileBuffer, sha, `media: ${path} aktualisiert`)

    if (webpPath && webpFile) {
      const webpBuffer = Buffer.from(await webpFile.arrayBuffer())
      const webpSha    = await getFileSha(fullName, webpPath)
      await commitFile(fullName, webpPath, webpBuffer, webpSha, `media: ${webpPath} (WebP) aktualisiert`)
    }

    return NextResponse.json({ commitUrl })
  } catch (err) {
    console.error('[repo-commit POST]', err)
    return NextResponse.json({ error: 'Commit fehlgeschlagen' }, { status: 500 })
  }
}
