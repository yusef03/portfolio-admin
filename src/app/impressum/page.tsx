export const metadata = {
  title: "Impressum — Admin Panel",
  robots: "noindex, nofollow",
};

export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-[640px] px-6 py-16 text-[var(--color-text-1)]">
      <h1 className="text-2xl font-semibold mb-6">Impressum</h1>
      <p className="text-sm text-[var(--color-text-2)] mb-8">Angaben gemäß § 5 TMG</p>

      <h2 className="text-lg font-medium mt-6 mb-2">Kontakt</h2>
      <p className="text-[var(--color-text-2)] leading-relaxed">
        Yusef Bach
        <br />
        Schützenweg 24
        <br />
        31061 Alfeld (Leine)
        <br />
        Deutschland
      </p>
      <p className="text-[var(--color-text-2)] leading-relaxed mt-3">
        Telefon: +49 156 79746896
        <br />
        E-Mail: kontakt@yusefbach.de
      </p>

      <h2 className="text-lg font-medium mt-6 mb-2">Verantwortlich für den Inhalt</h2>
      <p className="text-[var(--color-text-2)] leading-relaxed">Yusef Bach (Anschrift wie oben)</p>
    </main>
  );
}
