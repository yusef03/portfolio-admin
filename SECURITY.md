# Security Runbook — portfolio-admin

Dieses Dokument beschreibt die **manuellen Schritte außerhalb des Codes**,
die vor Go-Live abgearbeitet werden müssen. Der Code-Teil (Whitelist, PIN,
Rate-Limits, Security-Headers) ist im Repo bereits umgesetzt.

Reihenfolge ist absichtlich: **erst Secrets rotieren**, dann Whitelist ins ENV,
dann Supabase härten, dann Vercel-Env-Scope, dann Verify.

---

## 1. Secrets rotieren (SOFORT)

Die alten Werte aus `.env.local` gelten als potenziell exponiert. Rotieren:

### 1.1 Supabase Service Role Key
- Dashboard → Project Settings → API → `service_role` **Reset**.
- Neuen Wert nach `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` + Vercel setzen.
- Alten Wert nirgends mehr verwenden.

### 1.2 DeepL API Key
- deepl.com → Account → API Keys → alten Key löschen, neuen erzeugen.
- Neuen Wert nach `DEEPL_API_KEY`.

### 1.3 GitHub PAT (fine-grained)
- github.com → Settings → Developer settings → Personal access tokens →
  Fine-grained tokens → alten Token **Revoke**.
- **Neuen fine-grained PAT** erstellen mit:
  - Resource owner: `yusef03`
  - Repository access: **Only select repositories** → `yusef03/BETAPortfolioBach`
  - Repository permissions:
    - Contents: **Read and write**
    - Actions: **Read and write**
    - Metadata: **Read**
    - (alles andere: **No access**)
  - Expiration: **90 Tage** (Kalender-Erinnerung setzen)
- Neuen Wert nach `GITHUB_TOKEN`.

---

## 2. Admin-Whitelist konfigurieren

In `.env.local` **und** in Vercel Environment Variables setzen:

```
ADMIN_EMAILS=kontakt@yusefbach.de,yusefbach23@gmail.com
ADMIN_GITHUB_USERNAMES=yusef03
```

Die App prüft bei jedem Request **beide** Felder AND-verknüpft plus den
Auth-Provider (nur GitHub). Ein Fremder mit passender Email aber falschem
GitHub-Username kommt nicht rein — und umgekehrt.

---

## 3. Zweiter Faktor (Admin-PIN)

Ergänzt GitHub-Login um einen serverseitig geprüften PIN. Optional, aber
empfohlen (schützt bei kompromittiertem GitHub-Account).

```
ADMIN_PIN=<6-8 stellige Zahl, in Passwort-Manager speichern>
ADMIN_PIN_COOKIE_SECRET=<32+ Bytes Zufall, z.B. openssl rand -hex 32>
```

Ohne `ADMIN_PIN` ist der zweite Faktor deaktiviert. Wenn `ADMIN_PIN` gesetzt
ist, `ADMIN_PIN_COOKIE_SECRET` **muss** auch gesetzt sein.

Cookie-Ablauf: 8 Stunden (in `src/lib/pin.ts` änderbar).
Rate-Limit auf `/api/verify-pin`: 5 Versuche pro 15 Min pro IP.

---

## 4. Supabase härten

### 4.1 Signups deaktivieren
Dashboard → Authentication → Providers → **General**:
- „Allow new users to sign up" → **AUS**.

Damit legt der GitHub-Provider keinen neuen `auth.users`-Eintrag mehr an,
wenn jemand Unbekanntes einen OAuth-Roundtrip macht.

### 4.2 Row Level Security (RLS)
Alle Tabellen, die vom Browser aus mit dem `anon` key beschrieben werden
(siehe `src/app/dashboard/*/page.tsx`), müssen RLS-Policies haben:

| Tabelle       | Policy                                                       |
| ------------- | ------------------------------------------------------------ |
| `projects`    | select/insert/update/delete nur `auth.uid() = '<deine uid>'` |
| `thoughts`    | dito                                                         |
| `roadmap`     | dito                                                         |
| `changelog`   | dito                                                         |
| `settings`    | dito                                                         |
| `activity_log`| select/insert nur eingeloggt (Insert läuft serverseitig)     |

Deine `auth.users`-UID findest du im Supabase Dashboard → Authentication → Users.

Beispiel-Policy für `projects`:

```sql
alter table public.projects enable row level security;

create policy "yusef only"
on public.projects
for all
to authenticated
using (auth.uid() = '<uid hier>')
with check (auth.uid() = '<uid hier>');
```

**Verifikation:** In Supabase → SQL Editor als `anon`:
`select count(*) from projects;` → soll `0` liefern.

### 4.3 GitHub-Provider Scopes
Dashboard → Authentication → Providers → GitHub:
- Scopes minimal: `read:user user:email` (setzt der Login-Client schon).
- Redirect URLs: nur `https://admin.yusefbach.de/auth/callback`
  (dev: `http://localhost:3000/auth/callback`) — keine Wildcards.

---

## 5. Vercel Environment Variables

Für **jede** Variable:
- Scope auf **Production** (und ggf. Development), **nicht** Preview —
  Preview-Deployments hätten sonst Zugriff auf Prod-Tokens.
- Sensitive Werte: „Sensitive" ankreuzen (nicht im UI lesbar nach Save).

Variablen-Liste:
```
NEXT_PUBLIC_SUPABASE_URL      (Production, Preview, Development — public)
NEXT_PUBLIC_SUPABASE_ANON_KEY (Production, Preview, Development — public)
SUPABASE_SERVICE_ROLE_KEY     (Production only, sensitive)
DEEPL_API_KEY                 (Production only, sensitive)
GITHUB_TOKEN                  (Production only, sensitive)
GITHUB_REPO                   (Production, Development)
ADMIN_EMAILS                  (Production, Development)
ADMIN_GITHUB_USERNAMES        (Production, Development)
ADMIN_PIN                     (Production, Development, sensitive)
ADMIN_PIN_COOKIE_SECRET       (Production, Development, sensitive)
```

**Redeploy** nach dem Setzen (Vercel bakcht ENV-Vars in den Build).

---

## 6. Verify vor Go-Live

- [ ] `.env.local` enthält alle neuen Werte, alte Werte nirgends mehr.
- [ ] Alte Tokens im GitHub/DeepL/Supabase-Dashboard sind **revoked**.
- [ ] Login mit deinem GitHub-Account funktioniert → Redirect zu `/verify-pin`.
- [ ] Falscher PIN → 401, nach 5 Versuchen 429.
- [ ] Richtiger PIN → Redirect zu `/dashboard`.
- [ ] Ausloggen: Session weg, /dashboard blockt.
- [ ] Test mit **anderem GitHub-Account** (Zweitaccount, Freund):
      Redirect zu `/login?error=email_not_whitelisted`.
      Kein Zugriff auf `/dashboard`, kein Zugriff auf `/api/*`.
- [ ] `curl -i https://admin.yusefbach.de/api/health` ohne Session → 403.
- [ ] `curl -i https://admin.yusefbach.de/` → Security-Headers sichtbar
      (HSTS, X-Frame-Options, CSP).
- [ ] Supabase RLS: SQL-Editor als `anon` liest keine Zeilen.
- [ ] Vercel Preview-Deployment eines Fake-Branches: kann NICHT auf Prod-Repo
      committen (weil `GITHUB_TOKEN` nur in Production gesetzt).

---

## 7. Nach Go-Live

- Kalender-Erinnerung: GitHub-PAT-Rotation vor Ablauf.
- Bei Verdacht (Log-Auffälligkeiten, unbekannte Commits): sofort alle Secrets
  neu rotieren, `admin_pin_v1`-Cookie invalidieren durch Wechsel von
  `ADMIN_PIN_COOKIE_SECRET`, Supabase → Auth → alle Sessions revoken.
