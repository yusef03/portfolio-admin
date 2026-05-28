/**
 * POST /api/repo-commit
 * Committet eine Datei (und optional einen WebP-Partner) ins Portfolio-Repo
 * via GitHub Contents API. Erfordert Auth + GITHUB_TOKEN mit contents:write.
 * FormData: path (Repo-Pfad), file (Datei), optional: webpPath, webpFile
 */

import { NextResponse }    from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies }         from 'next/headers'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_REPO  = process.env.GITHUB_REPO ?? 'yusef03/BETAPortfolioBach'

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

async function getFileSha(path: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
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
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
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

  if (!res.ok) {
    const err = await res.json() as { message?: string }
    throw new Error(err.message ?? `GitHub API: HTTP ${res.status}`)
  }

  const data = await res.json() as { commit: { html_url: string } }
  return data.commit.html_url
}

export async function POST(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'GITHUB_TOKEN fehlt' }, { status: 500 })

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

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const sha        = await getFileSha(path)
    const commitUrl  = await commitFile(path, fileBuffer, sha, `media: ${path} aktualisiert`)

    if (webpPath && webpFile) {
      const webpBuffer = Buffer.from(await webpFile.arrayBuffer())
      const webpSha    = await getFileSha(webpPath)
      await commitFile(webpPath, webpBuffer, webpSha, `media: ${webpPath} (WebP) aktualisiert`)
    }

    return NextResponse.json({ commitUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
