# portfolio-admin — Architektur & Betrieb

Diese Datei ist der zentrale Einstieg für alles, was mit dem Admin Panel zu tun
hat: wie es aufgebaut ist, wie die Auth funktioniert, mit welchen Systemen es
verkabelt ist, und **wie der Repo-Umschwung beim Go-Live v3 abläuft**.

Für den einmaligen Security-Setup (Secrets rotieren, Supabase härten, Vercel-
Env setzen): siehe [SECURITY.md](SECURITY.md).

---

## 1. Was das Panel ist

Ein Next.js 16 (App Router) Admin Panel unter **admin.yusefbach.de**, das den
Content und die Konfiguration des öffentlichen Portfolios verwaltet:

- Übersetzungen (DE/EN/AR), Projekte, Roadmap, Thoughts, Changelog
- Media (Bilder, CV, Dokumente)
- Bot-Memory (`yusef_brain.md`) — der System-Prompt des AI-Twin
- Maintenance-/Notfall-Modus (schaltet das Portfolio-Frontend um)
- Health-Dashboard über alle Subsysteme

Zugang: **nur Yusef Bach.** Whitelist auf GitHub-Login + Admin-PIN als zweiter
Faktor. Details in [§4](#4-auth--sicherheitsmodell).

---

## 2. Verkabelung — mit welchen Systemen kommuniziert es?

```
┌───────────────────┐            ┌──────────────────────┐
│  admin.yusefbach  │──── OAuth ──►  GitHub (yusef03)   │
│   (Vercel)        │◄──cbk──────  (User-Login)         │
│                   │            └──────────────────────┘
│                   │
│                   │  contents / actions API           ┌─────────────────────────┐
│                   │──────────────────────────────────►│  yusef03/BETAPortfolio  │
│                   │  (Text + Media + Workflows)       │  (bzw. später Portfolio)│
│                   │                                   └─────────────────────────┘
│                   │
│                   │  select/insert/update           ┌─────────────────────────┐
│                   │◄────────────────────────────────►│  Supabase Postgres      │
│                   │  auth · projects · thoughts ·   │  (msfmugoazylvbqvyidlg) │
│                   │  roadmap · changelog · settings·│  + Storage              │
│                   │  activity_log                   │  + Auth (GitHub OAuth)  │
│                   │                                 └─────────────────────────┘
│                   │
│                   │  translate                      ┌─────────────────────────┐
│                   │────────────────────────────────►│  DeepL (api-free)       │
│                   │                                 └─────────────────────────┘
└───────────────────┘
```

Alle Aufrufe an GitHub, Supabase (service_role) und DeepL laufen **serverseitig**
in Next.js API-Routes. Der Browser hat nur den Supabase-`anon`-Key + spricht
mit den eigenen Admin-API-Routes.

---

## 3. Datei-Struktur

```
portfolio-admin/
├── ARCHITECTURE.md              ← diese Datei
├── SECURITY.md                  ← Runbook zum einmaligen Absichern
├── next.config.ts               ← Security-Headers (CSP, HSTS, X-Frame-Options)
├── .env.local                   ← lokale Secrets (NICHT committed)
├── .env.local.example           ← Vorlage/Doku welche Vars gebraucht werden
├── src/
│   ├── proxy.ts                 ← Next.js 16 Proxy (früher middleware.ts) —
│   │                              Auth-Gate für /dashboard und /api/*
│   ├── lib/
│   │   ├── auth.ts              ← requireAdmin() — Whitelist + PIN-Check
│   │   ├── pin.ts               ← HMAC-Cookie für zweiten Faktor
│   │   ├── rate-limit.ts        ← In-Memory Sliding-Window
│   │   ├── repo-config.ts       ← getRepoConfig() — Ziel-Repo aus ENV, keine
│   │   │                          Hardcodes, fail-fast bei fehlender ENV
│   │   ├── supabase/            ← Supabase-Clients (browser + server)
│   │   ├── github.ts            ← publish-Workflow Trigger + Status
│   │   ├── health.ts            ← System-Health-Checks
│   │   ├── activity.ts          ← activity_log Insert/Query
│   │   ├── deepl.ts             ← DeepL-Client
│   │   ├── media.ts             ← Media-Manifest-Typen
│   │   └── types.ts             ← geteilte Typen
│   ├── app/
│   │   ├── login/page.tsx       ← GitHub-OAuth-Trigger + Error-Anzeige
│   │   ├── verify-pin/page.tsx  ← Zweiter Faktor (nach OAuth)
│   │   ├── auth/callback/       ← OAuth-Callback: Whitelist-Check + Redirect
│   │   ├── dashboard/           ← alle Admin-Seiten
│   │   │   ├── translations/    ← lang/*.json Editor (repo-first)
│   │   │   ├── projects/        ← Supabase-Tabelle projects
│   │   │   ├── roadmap/         ← Supabase-Tabelle roadmap
│   │   │   ├── changelog/       ← Supabase-Tabelle changelog
│   │   │   ├── thoughts/        ← Supabase-Tabelle thoughts
│   │   │   ├── bot-memory/      ← yusef_brain.md Editor (repo-first)
│   │   │   ├── media/           ← Storage + Repo-Media
│   │   │   ├── maintenance/     ← Supabase settings-Tabelle
│   │   │   └── activity/        ← activity_log Viewer
│   │   └── api/
│   │       ├── verify-pin/      ← POST — PIN prüfen, Cookie setzen
│   │       ├── bot-memory/      ← GET/POST — yusef_brain.md lesen/committen
│   │       ├── lang-files/      ← GET/POST — lang/*.json lesen/committen
│   │       ├── repo-commit/     ← POST — Media/beliebige Datei committen
│   │       ├── publish/         ← POST/GET — GitHub-Workflow trigger/status
│   │       ├── translate/       ← POST — DeepL-Übersetzung
│   │       ├── media-manifest/  ← GET — media-manifest.json aus Repo
│   │       ├── activity/        ← GET/POST — Activity-Log
│   │       └── health/          ← GET — Health über alle Systeme
│   └── components/              ← UI (Sidebar, Toast, CommandPalette, ui/)
└── scripts/                     ← Dev-Utilities (build-media-manifest etc.)
```

---

## 4. Auth & Sicherheitsmodell

Vier voneinander unabhängige Ebenen. Ein Angriff, der eine Ebene durchbricht,
scheitert an den nächsten drei.

### Ebene 1 — Supabase-Signup deaktiviert
In der Supabase-Konsole ist `Allow new user signups = OFF`. Ein fremder GitHub-
Account, der über OAuth zurückkommt, bekommt **keinen** `auth.users`-Eintrag.
Effekt: die Session-Erstellung schlägt fehl. Keine Session → nichts.

### Ebene 2 — Whitelist auf Server-Seite (jeder Request)
`src/lib/auth.ts → isAuthorizedUser()` prüft vier Felder AND-verknüpft:
- Session existiert
- `user.app_metadata.provider === 'github'` (kein Email-Login, keine anderen OAuth)
- `user.email` in `ADMIN_EMAILS` (aktuell: `kontakt@yusefbach.de`, `yusefbach23@gmail.com`)
- `user.user_metadata.user_name` in `ADMIN_GITHUB_USERNAMES` (aktuell: `yusef03`)
- Email ist verified

Nicht bestanden → sofortiger `signOut()` + Redirect zu `/login?error=<grund>`.

### Ebene 3 — Admin-PIN (zweiter Faktor)
Nach OAuth-Login landet der User auf `/verify-pin`. Der PIN wird gegen
`ADMIN_PIN` in ENV geprüft (konstant-Zeit-Vergleich in `src/lib/pin.ts`).
Bei Match wird ein **HMAC-signiertes** HttpOnly/Secure-Cookie gesetzt
(`admin_pin_v1`), gültig 8h. Signatur mit `ADMIN_PIN_COOKIE_SECRET`.

Der Proxy prüft dieses Cookie bei jedem Request an `/dashboard` und `/api/*`.
Fehlt/ungültig → Redirect zu `/verify-pin` (Browser) bzw. 403 (API).

Rate-Limit auf `/api/verify-pin`: **5 Versuche / 15 Min / IP**.

### Ebene 4 — Rate-Limits + Input-Validierung
Alle write-APIs haben In-Memory Sliding-Window Rate-Limits (`src/lib/rate-limit.ts`).
Zusätzlich: Path-Validierung (`isSafeRepoPath` in `repo-commit`), Größen-Limits,
Content-Type-Whitelists.

### Header-Ebene
`next.config.ts` setzt:
- **HSTS** 1 Jahr, includeSubDomains, preload
- **CSP** — `default-src 'self'`, script/style nur self+inline (in Prod ohne
  `unsafe-eval`; nur Dev braucht das für React-DevTools)
- **X-Frame-Options: DENY** + `frame-ancestors 'none'` (Clickjacking)
- **Referrer-Policy** `strict-origin-when-cross-origin`
- **Permissions-Policy** kamera/mikro/geo aus
- **X-Content-Type-Options: nosniff**
- **poweredByHeader: false**

### Committer-Identität
Alle GitHub-Commits, die das Panel macht, tragen fest:
`{ name: 'Yusef Bach', email: 'kontakt@yusefbach.de' }`. Das ist die
Identität in Git-History, unabhängig vom Ziel-Repo.

---

## 5. Environment-Variablen (alle)

| Variable                     | Zweck                                              | Wo gesetzt                | Sensitive |
| ---------------------------- | -------------------------------------------------- | ------------------------- | --------- |
| `NEXT_PUBLIC_SUPABASE_URL`   | Supabase Projekt-URL                               | .env.local + Vercel       | nein      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Anon-Key (Browser)                        | .env.local + Vercel       | nein      |
| `SUPABASE_SERVICE_ROLE_KEY`  | Voller DB-Zugriff (nur Server)                     | .env.local + Vercel Prod  | **ja**    |
| `DEEPL_API_KEY`              | DeepL-Übersetzung (Free-Tier)                      | .env.local + Vercel Prod  | **ja**    |
| `GITHUB_TOKEN`               | Fine-grained PAT, `Contents+Actions` write         | .env.local + Vercel Prod  | **ja**    |
| `GITHUB_REPO`                | **Ziel-Repo**, `owner/repo`. **Das steuert V3.**   | .env.local + Vercel       | nein      |
| `ADMIN_EMAILS`               | Comma-separated Whitelist (Emails, lowercase)      | .env.local + Vercel       | nein      |
| `ADMIN_GITHUB_USERNAMES`     | Comma-separated Whitelist (GitHub-Logins)          | .env.local + Vercel       | nein      |
| `ADMIN_PIN`                  | 6–8-stellige Zahl (zweiter Faktor)                 | .env.local + Vercel Prod  | **ja**    |
| `ADMIN_PIN_COOKIE_SECRET`    | 32+ Bytes Hex — HMAC für PIN-Cookie                | .env.local + Vercel Prod  | **ja**    |

**Vercel-Scope-Regel:** sensible Values NIE auf Preview-Deployments legen —
sonst hätte jede Preview-URL Zugriff auf Prod-Tokens.

---

## 6. Datenfluss pro Feature

| Bereich       | Quelle der Wahrheit         | Schreibweg                              |
| ------------- | --------------------------- | --------------------------------------- |
| Translations  | `lang/*.json` im Ziel-Repo  | `/api/lang-files` → 3 GitHub-Commits    |
| Bot-Memory    | `api/yusef_brain.md` im Repo| `/api/bot-memory` → 1 GitHub-Commit     |
| Media         | Repo (`public/`) + Supabase Storage | `/api/repo-commit` + Storage-CRUD |
| Projects      | Supabase Tabelle `projects` | Browser → Supabase (RLS!)               |
| Roadmap       | Supabase Tabelle `roadmap`  | Browser → Supabase (RLS!)               |
| Changelog     | Supabase Tabelle `changelog`| Browser → Supabase (RLS!)               |
| Thoughts      | Supabase Tabelle `thoughts` | Browser → Supabase (RLS!)               |
| Maintenance   | Supabase Tabelle `settings` | Browser → Supabase (RLS!)               |
| Publish       | GitHub Actions Workflows    | `/api/publish` → workflow_dispatch      |
| Activity-Log  | Supabase Tabelle `activity_log` | Server-side via `SUPABASE_SERVICE_ROLE_KEY` |

Nach dem Schreiben in Supabase-Tabellen (Projects/Roadmap/Thoughts) muss der
User in der UI **„Publish"** klicken — das triggert einen GitHub-Workflow, der
die Daten in JSON-Files ins Repo commit und damit die statische Portfolio-Seite
neu deploy.

Translations und Bot-Memory laufen **repo-first**: kein Publish nötig, weil
direkt ins Repo committed wird → Vercel-Backend deploy nachher automatisch.

---

## 7. V3-Repo-Umschwung — Runbook

Aktuell: `GITHUB_REPO = yusef03/BETAPortfolioBach`
Nach v3: `GITHUB_REPO = yusef03/PortfolioBach`

Weil alle Repo-Bezüge im Code durch `getRepoConfig()` gehen und kein Hardcode
mehr existiert, ist der Umschwung **eine einzige ENV-Änderung**.

### Voraussetzungen im neuen Ziel-Repo (`yusef03/PortfolioBach`)
Diese Files/Workflows müssen existieren, sonst greifen Publish/Translations/Bot-
Memory ins Leere:

1. `api/yusef_brain.md`
2. `lang/de.json`, `lang/en.json`, `lang/ar.json`
3. `media-manifest.json`
4. `.github/workflows/publish-projects.yml`
5. `.github/workflows/publish-roadmap.yml`
6. `.github/workflows/publish-thoughts.yml`

### Schritte (in dieser Reihenfolge)

1. **Neuen GitHub-PAT für das Ziel-Repo erstellen**
   - Fine-grained, Resource: `yusef03`, Repo: `yusef03/PortfolioBach`
   - Permissions: Contents RW, Actions RW, Metadata R
   - 90 Tage Expiry
2. **Vercel Environment Variables** (Production)
   - `GITHUB_REPO` → `yusef03/PortfolioBach`
   - `GITHUB_TOKEN` → neuer PAT
   - alle anderen Variablen bleiben
3. **Vercel Redeploy** — Deployments → letztes Deployment → ⋯ → Redeploy
4. **Smoke-Test** (in dieser Reihenfolge, jeweils auf admin.yusefbach.de)
   - `/dashboard` lädt (Auth-Ebenen greifen)
   - Health-Karte „Letzter Publish" zeigt Runs aus dem neuen Repo
   - Bot-Memory-Seite lädt `yusef_brain.md` aus neuem Repo
   - Translations-Seite zeigt Keys aus neuem Repo
   - **Testcommit:** eine harmlose Translation ändern → Commit landet im
     **richtigen** Repo (im GitHub-UI checken)
5. **Alten PAT revoken** (github.com → Settings → Developer settings)
6. Fertig.

### Rollback
Falls im Smoke-Test etwas nicht stimmt: `GITHUB_REPO` und `GITHUB_TOKEN`
in Vercel wieder auf die alten Werte, Redeploy. Dauert 30 Sekunden, keine
Datenverluste.

---

## 8. Local Development

```bash
# Voraussetzungen: Node.js 20.9+, .env.local mit gültigen Werten
cd portfolio-admin
npm install
npm run dev        # http://localhost:3000
```

Login lokal: identisch zur Prod — GitHub-OAuth mit deinem `yusef03`-Account,
dann PIN eingeben. Die Whitelist gilt lokal genauso.

Wenn du `ADMIN_PIN` in `.env.local` leer lässt, ist der zweite Faktor
deaktiviert (praktisch für schnelle lokale Iterationen).

**Typecheck & Build:**
```bash
node node_modules/typescript/lib/tsc.js --noEmit
npm run build
```

---

## 9. Deployment

- **Hosting:** Vercel (Projekt `portfolio-admin`, Team `yusef03's projects`)
- **Domain:** `admin.yusefbach.de` (CNAME auf Vercel)
- **Git-Integration:** Push auf `main` → Vercel baut & deployed automatisch
- **Preview-Deployments:** Feature-Branches bekommen `*.vercel.app`-URLs.
  **Sensible ENV-Vars sind auf Production-only beschränkt** — Preview kann
  keine Commits ins Repo machen (safe by design).

---

## 10. Was NICHT in dieses Panel gehört

- Öffentliche Portfolio-Inhalte werden im **Repo** gepflegt, nicht im Panel.
- Der Bot (FastAPI+Gemini) läuft separat auf Vercel und liest `yusef_brain.md`
  direkt aus dem Repo — das Panel ist nur der Editor für diese Datei.

---

## 11. Bei Problemen

- **Login-Loop / „unendlich lädt":** meist ein CSP-Konflikt (im Dev-Mode braucht
  React `unsafe-eval`). Prüfen: Browser-DevTools → Console → nach „eval" suchen.
- **Nach Login sofort auf `/login?error=email_not_whitelisted`:** deine
  primary GitHub-Email steht nicht in `ADMIN_EMAILS`, oder ist im GitHub-Profil
  auf „private" — dann kommt eine `@users.noreply.github.com` durch.
  Fix: entweder Email in Whitelist ergänzen, oder GitHub-Email-Privacy aus.
- **PIN funktioniert nicht:** `ADMIN_PIN_COOKIE_SECRET` fehlt in ENV, oder wurde
  neu generiert (dann alle Sessions ungültig — nochmal PIN eingeben).
- **Commits landen im falschen Repo:** `GITHUB_REPO` in Vercel ist falsch. Der
  Code hat **keinen** Fallback, `getRepoConfig()` würde bei fehlender ENV eine
  saubere Fehlermeldung werfen (500 mit „GITHUB_REPO env var fehlt").
