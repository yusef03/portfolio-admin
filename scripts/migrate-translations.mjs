/**
 * migrate-translations.mjs
 *
 * Einmalige Migration: liest lang/de.json + lang/en.json aus dem Portfolio-Repo
 * und schreibt alle Keys in die Supabase-Tabelle `translations`.
 *
 * Ausführen (aus portfolio-admin/):
 *   node --env-file=.env.local scripts/migrate-translations.mjs
 *
 * Sicher: upsert auf "key" — kann beliebig oft laufen ohne Duplikate.
 * Bestehende Werte werden NICHT überschrieben (ignoredConflictColumns).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ─── Pfade ────────────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
const PORTFOLIO_LANG = resolve(__dir, '../../BETAPortfolioBach/lang')

// ─── Supabase (Service Role — umgeht RLS, nur in Scripts verwenden) ───────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── Hilfsfunktion ────────────────────────────────────────────────────────────
function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch (e) {
    console.error(`❌  Kann ${filePath} nicht lesen:`, e.message)
    process.exit(1)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📖  Lese JSON-Dateien...')
  const de = readJson(resolve(PORTFOLIO_LANG, 'de.json'))
  const en = readJson(resolve(PORTFOLIO_LANG, 'en.json'))

  const deKeys = Object.keys(de)
  const enKeys = new Set(Object.keys(en))

  console.log(`   DE: ${deKeys.length} Keys`)
  console.log(`   EN: ${Object.keys(en).length} Keys`)

  // Keys die in DE aber nicht in EN vorkommen
  const missingInEn = deKeys.filter(k => !enKeys.has(k))
  if (missingInEn.length > 0) {
    console.warn(`⚠️  ${missingInEn.length} Keys nur in DE, nicht in EN:`)
    missingInEn.forEach(k => console.warn(`     - ${k}`))
  }

  // Rows aufbauen
  const rows = deKeys.map(key => ({
    key,
    de: de[key] ?? '',
    en: en[key] ?? '',
    ar: '',          // AR noch leer — wird später per DeepL gefüllt
  }))

  console.log(`\n⬆️   Starte Upsert von ${rows.length} Zeilen nach Supabase...`)

  // In Batches von 100 upserten (Supabase-Limit)
  const BATCH = 100
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)

    const { error, data } = await supabase
      .from('translations')
      .upsert(batch, {
        onConflict: 'key',
        ignoreDuplicates: true,   // bestehende Einträge nicht überschreiben
      })
      .select()

    if (error) {
      console.error(`❌  Fehler bei Batch ${Math.floor(i / BATCH) + 1}:`, error.message)
      process.exit(1)
    }

    const batchInserted = data?.length ?? 0
    const batchSkipped = batch.length - batchInserted
    inserted += batchInserted
    skipped += batchSkipped

    process.stdout.write(`   Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(rows.length / BATCH)}: ${batchInserted} neu, ${batchSkipped} übersprungen\n`)
  }

  console.log(`\n✅  Migration abgeschlossen!`)
  console.log(`   Neu eingefügt: ${inserted}`)
  console.log(`   Übersprungen (bereits vorhanden): ${skipped}`)
  console.log(`   AR-Spalte ist leer — wird später per DeepL im Admin Panel befüllt.`)
}

main().catch(e => {
  console.error('❌  Unerwarteter Fehler:', e)
  process.exit(1)
})
