/**
 * Zentrale Repo-Config.
 *
 * Alle Repo-Bezüge im Code (owner/name für die GitHub API) MÜSSEN durch diese
 * Utility gehen. Kein Hardcode, kein Fallback — beim V3-Go-Live wird nur die
 * ENV-Variable `GITHUB_REPO` in Vercel umgestellt (z.B. von
 * `yusef03/BETAPortfolioBach` auf `yusef03/PortfolioBach`) und die App zieht
 * automatisch mit.
 *
 * Fail-fast: wenn `GITHUB_REPO` fehlt oder das Format falsch ist, wirft die
 * Utility einen klaren Fehler. Wird pro Route in einem try/catch abgefangen und
 * als generischer 500 an den Client zurückgegeben.
 */

export interface RepoConfig {
  owner: string
  repo: string
  fullName: string // "owner/repo"
}

const REPO_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/

let cached: RepoConfig | null = null

export function getRepoConfig(): RepoConfig {
  if (cached) return cached

  const raw = process.env.GITHUB_REPO
  if (!raw) {
    throw new Error('GITHUB_REPO env var fehlt (Format: owner/repo)')
  }
  if (!REPO_PATTERN.test(raw)) {
    throw new Error(`GITHUB_REPO ungültig: "${raw}" (Format: owner/repo)`)
  }

  const [owner, repo] = raw.split('/')
  cached = { owner, repo, fullName: raw }
  return cached
}
