# Portfolio Admin — Yusef Bach

Privates Admin Panel für [yusefbach.de](https://yusefbach.de). Verwaltet Translations, Projects, Roadmap,
Changelog, Thoughts (Blog), Media, Bot Memory und den Maintenance-Modus — schreibt nach Supabase / committet
ins Portfolio-Repo und stößt GitHub-Action-Publishes an.

- **Live:** [admin.yusefbach.de](https://admin.yusefbach.de) (Vercel)
- **Stack:** Next.js (App Router) · TypeScript · Tailwind v4 · Supabase (Auth/DB/Storage)
- **Design-System „SPACE":** Apple-Stil, Dark + Light, Inter + JetBrains Mono, Command-Palette (⌘K),
  `lucide-react` Icons, `framer-motion` Animationen. **Alle Design-Tokens in `src/app/tokens.css`** (eine Wahrheit).
- **Security:** vier unabhängige Ebenen — Supabase-Signups deaktiviert, server-seitige E-Mail+GitHub-Username-Whitelist,
  PIN als zweiter Faktor (HMAC-signiertes Cookie, rate-limitiert), Security-Headers auf allen Write-Pfaden.
  Details: `internal-docs/aktuell/admin-panel.md` (privat, im Portfolio-Repo).
- **Repo-Ziel:** `src/lib/repo-config.ts` ist die einzige Wahrheitsquelle für das Ziel-Repo (`GITHUB_REPO`-Env-Var,
  fail-fast) — macht den Umschalt Beta→Live-Repo zu einer einzigen Env-Var-Änderung.

## Lokal starten

```bash
npm install
npm run dev -- -p 3007      # http://localhost:3007
```

> **Dev-Bypass:** Lokal (`NODE_ENV=development`) ist `/dashboard` ohne Login erreichbar (siehe `src/middleware.ts`).
> Production (Vercel) bleibt durch GitHub-OAuth geschützt.

## Wichtige Orte

| Was | Pfad |
|---|---|
| Design-Tokens (Farben/Fonts/Radius) | `src/app/tokens.css` |
| UI-Primitives | `src/components/ui/` |
| Command-Palette (⌘K) | `src/components/CommandPalette.tsx` |
| App-Shell (Sidebar/Drawer) | `src/app/dashboard/layout.tsx` + `src/components/Sidebar.tsx` |
| Seiten | `src/app/dashboard/<bereich>/page.tsx` |
| Supabase-Clients | `src/lib/supabase/` |

## Vollständige Doku

Die ausführliche Dokumentation liegt **privat** im Portfolio-Repo unter `BETAPortfolioBach/internal-docs/`:
- `aktuell/admin-panel.md` — Infrastruktur (URLs, Keys, DNS, Vercel, Code-Struktur)
- `aktuell/admin-design-system.md` — Design-System „SPACE" (Tokens, Primitives, Seiten-Konzepte, Mobile)
