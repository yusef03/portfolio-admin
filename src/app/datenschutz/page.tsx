export const metadata = {
  title: "Datenschutz — Admin Panel",
  robots: "noindex, nofollow",
};

export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-[640px] px-6 py-16 text-[var(--color-text-1)]">
      <h1 className="text-2xl font-semibold mb-6">Datenschutzerklärung</h1>
      <p className="text-[var(--color-text-2)] leading-relaxed mb-6">
        Dieses Admin Panel ist ein privates Verwaltungswerkzeug für{" "}
        <a href="https://yusefbach.de" className="underline">
          yusefbach.de
        </a>{" "}
        und nicht für die öffentliche Nutzung bestimmt. Zugriff auf die Inhalte erhält ausschließlich
        Yusef Bach über einen geschützten Login. Verantwortlich für die Datenverarbeitung: Yusef Bach
        (Kontaktdaten siehe{" "}
        <a href="/impressum" className="underline">
          Impressum
        </a>
        ).
      </p>

      <h2 className="text-lg font-medium mt-6 mb-2">Hosting (Vercel)</h2>
      <p className="text-[var(--color-text-2)] leading-relaxed">
        Diese Anwendung wird bei <strong>Vercel Inc.</strong> (USA) gehostet. Beim Aufruf der Seite
        speichert Vercel automatisch technische Daten (IP-Adresse, Browser, Uhrzeit) in Logfiles —
        technisch notwendig für die sichere Auslieferung (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2 className="text-lg font-medium mt-6 mb-2">Login (GitHub OAuth) &amp; Datenbank (Supabase)</h2>
      <p className="text-[var(--color-text-2)] leading-relaxed">
        Der Login läuft über GitHub OAuth (GitHub Inc., USA). Nutzer- und Inhaltsdaten werden bei{" "}
        <strong>Supabase</strong> (Supabase Inc.) verarbeitet. Der Zugriff ist durch eine
        serverseitige Whitelist sowie eine PIN-Zweitfaktor-Prüfung (technisch notwendiges, signiertes
        Cookie) zusätzlich abgesichert. Rechtsgrundlage: berechtigtes Interesse an einem sicheren
        Betrieb dieses Verwaltungswerkzeugs (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2 className="text-lg font-medium mt-6 mb-2">Cookies &amp; Tracking</h2>
      <p className="text-[var(--color-text-2)] leading-relaxed">
        Es werden keine Tracking-Cookies, kein Analytics und keine Werbe-Tracker eingesetzt. Gesetzte
        Cookies dienen ausschließlich der Anmeldung und Absicherung des Zugriffs.
      </p>
    </main>
  );
}
