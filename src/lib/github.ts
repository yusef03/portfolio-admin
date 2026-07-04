/**
 * GitHub API Client
 * Nur serverseitig verwenden — Token darf nie im Browser landen.
 * Ziel-Repo kommt aus getRepoConfig() (Vercel-ENV GITHUB_REPO).
 */

import { getRepoConfig } from './repo-config'

// Translations laufen seit dem repo-first-Umbau NICHT mehr über einen
// publish-Workflow, sondern committen direkt via /api/lang-files. Daher hier
// kein 'translations'-Target mehr.
const WORKFLOW_FILES = {
  projects:     'publish-projects.yml',
  roadmap:      'publish-roadmap.yml',
  thoughts:     'publish-thoughts.yml',
} as const

export type PublishTarget = keyof typeof WORKFLOW_FILES

/**
 * Triggert einen GitHub Actions Workflow via workflow_dispatch.
 * target: 'projects' | 'roadmap' | 'thoughts'
 */
export async function triggerPublish(
  target: PublishTarget
): Promise<{ ok: boolean; message: string }> {
  const token = process.env.GITHUB_TOKEN
  if (!token) return { ok: false, message: 'GITHUB_TOKEN nicht gesetzt' }

  const { fullName } = getRepoConfig()
  const workflowFile = WORKFLOW_FILES[target]
  const url = `https://api.github.com/repos/${fullName}/actions/workflows/${workflowFile}/dispatches`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main' }),
  })

  if (res.status === 204) {
    return { ok: true, message: 'Workflow gestartet — live in ~1-2 Minuten' }
  }

  const body = await res.text()
  return { ok: false, message: `GitHub Fehler ${res.status}: ${body}` }
}

/**
 * Gibt den Status des letzten Runs für einen Workflow zurück.
 */
export async function getLastPublishStatus(
  target: PublishTarget
): Promise<{
  status: 'running' | 'success' | 'failure' | 'unknown'
  url?: string
  createdAt?: string
}> {
  const token = process.env.GITHUB_TOKEN
  if (!token) return { status: 'unknown' }

  const { fullName } = getRepoConfig()
  const workflowFile = WORKFLOW_FILES[target]
  const url = `https://api.github.com/repos/${fullName}/actions/workflows/${workflowFile}/runs?per_page=1`

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!res.ok) return { status: 'unknown' }

    const data = await res.json()
    const run = data.workflow_runs?.[0]
    if (!run) return { status: 'unknown' }

    const status =
      run.status === 'completed'
        ? run.conclusion === 'success' ? 'success' : 'failure'
        : 'running'

    return { status, url: run.html_url, createdAt: run.created_at }
  } catch {
    return { status: 'unknown' }
  }
}
