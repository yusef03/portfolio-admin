/**
 * migrate-projects.mjs
 *
 * Einmaliges Migrations-Script: Schreibt die 5 bestehenden Projekte aus
 * projects-data.ts + die Beschreibungen/Features aus lang/de.json + lang/en.json
 * in die Supabase-Tabelle 'projects'.
 *
 * Auch: Legt den settings-Eintrag 'archive_github_card' an.
 *
 * Ausführen (aus portfolio-admin/):
 *   node scripts/migrate-projects.mjs
 *
 * Benötigt .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Env-Vars laden
const envPath = join(__dirname, '../.env.local')
let envContent = ''
try {
  envContent = readFileSync(envPath, 'utf-8')
} catch {
  console.error('❌  .env.local nicht gefunden in portfolio-admin/')
  process.exit(1)
}
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen in .env.local')
  process.exit(1)
}

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
}

// Sprachdateien laden
const portfolioRoot = join(__dirname, '../../BETAPortfolioBach')
const de = JSON.parse(readFileSync(join(portfolioRoot, 'lang/de.json'), 'utf-8'))
const en = JSON.parse(readFileSync(join(portfolioRoot, 'lang/en.json'), 'utf-8'))
const ar = JSON.parse(readFileSync(join(portfolioRoot, 'lang/ar.json'), 'utf-8'))

// Hilfsfunktionen
function t(key, lang) {
  const map = { de, en, ar }
  return map[lang]?.[key] || ''
}

function statusToEnum(deText) {
  if (!deText) return 'active'
  if (deText.includes('Entwicklung') || deText.includes('Development')) return 'in-progress'
  if (deText.includes('Beendet') || deText.includes('Completed') || deText.includes('Abgeschlossen')) return 'completed'
  return 'active' // "Live", "Aktiv", etc.
}

// 5 Projekte aus der aktuellen Codebasis
// Sortiert nach ursprünglicher Reihenfolge in projects-data.ts
const PROJECTS = [
  {
    slug: 'studynexus',
    title: 'StudyNexus',
    description_de: t('sn_desc', 'de'),
    description_en: t('sn_desc', 'en'),
    description_ar: t('sn_desc', 'ar'),
    badges: ['Next.js 14', 'FastAPI', 'PostgreSQL', 'Docker', 'Redis', 'TypeScript', 'Python'],
    features: [
      { de: t('sn_feat_1', 'de'), en: t('sn_feat_1', 'en'), ar: t('sn_feat_1', 'ar') },
      { de: t('sn_feat_2', 'de'), en: t('sn_feat_2', 'en'), ar: t('sn_feat_2', 'ar') },
      { de: t('sn_feat_3', 'de'), en: t('sn_feat_3', 'en'), ar: t('sn_feat_3', 'ar') },
    ],
    status: 'in-progress',
    image_url: 'images/projects/studynexus/preview.svg',
    github_url: 'https://github.com/yusef03/studynexus',
    demo_url: null,
    subpage_url: 'projects/studynexus.html',
    timeframe: '04/2026 — laufend',
    role: 'Product Owner & Full-Stack Developer',
    is_hero: true,
    sort_order: 0,
  },
  {
    slug: 'phishing-defender',
    title: 'PhishingDefender',
    description_de: t('pd_desc', 'de'),
    description_en: t('pd_desc', 'en'),
    description_ar: t('pd_desc', 'ar'),
    badges: ['Java 17', 'Swing / AWT', 'Gson (JSON)', 'MVC Pattern'],
    features: [
      { de: t('pd_feat_java', 'de'), en: t('pd_feat_java', 'en'), ar: t('pd_feat_java', 'ar') },
      { de: t('pd_feat_arch', 'de'), en: t('pd_feat_arch', 'en'), ar: t('pd_feat_arch', 'ar') },
      { de: t('pd_feat_features', 'de'), en: t('pd_feat_features', 'en'), ar: t('pd_feat_features', 'ar') },
    ],
    status: 'completed',
    image_url: 'images/projects/phishing/hero.png',
    github_url: 'https://github.com/yusef03/PhishingDefender',
    demo_url: null,
    subpage_url: 'projects/phishing-defender.html',
    timeframe: null,
    role: null,
    is_hero: false,
    sort_order: 1,
  },
  {
    slug: 'html-cv',
    title: 'HTML/CSS CV Engine',
    description_de: t('proj_cv_desc', 'de'),
    description_en: t('proj_cv_desc', 'en'),
    description_ar: t('proj_cv_desc', 'ar'),
    badges: ['HTML5', 'CSS3 Print', 'Git Privacy', 'Glassmorphism'],
    features: [
      { de: t('cv_card_feat_1', 'de'), en: t('cv_card_feat_1', 'en'), ar: t('cv_card_feat_1', 'ar') },
      { de: t('cv_card_feat_2', 'de'), en: t('cv_card_feat_2', 'en'), ar: t('cv_card_feat_2', 'ar') },
      { de: t('cv_card_feat_3', 'de'), en: t('cv_card_feat_3', 'en'), ar: t('cv_card_feat_3', 'ar') },
    ],
    status: 'completed',
    image_url: 'images/projects/cv-engine/cv.png',
    github_url: 'https://github.com/yusef03/Custom-Modern-Html-CV',
    demo_url: null,
    subpage_url: 'projects/html-cv.html',
    timeframe: null,
    role: null,
    is_hero: false,
    sort_order: 2,
  },
  {
    slug: 'community-software',
    title: 'Community Projekt',
    description_de: t('community_desc', 'de'),
    description_en: t('community_desc', 'en'),
    description_ar: t('community_desc', 'ar'),
    badges: ['Lua', 'JavaScript', 'SQL Optimization', 'Git Release Management', '2nd-Level Support'],
    features: [
      { de: t('community_feat_1', 'de'), en: t('community_feat_1', 'en'), ar: t('community_feat_1', 'ar') },
      { de: t('community_feat_2', 'de'), en: t('community_feat_2', 'en'), ar: t('community_feat_2', 'ar') },
      { de: t('community_feat_3', 'de'), en: t('community_feat_3', 'en'), ar: t('community_feat_3', 'ar') },
    ],
    status: 'active',
    image_url: 'images/projects/community/com.png',
    github_url: 'https://github.com/yusef03',
    demo_url: null,
    subpage_url: 'projects/community-software.html',
    timeframe: '01/2021 - 09/2023',
    role: 'Lead Developer & Community Management',
    is_hero: false,
    sort_order: 3,
  },
  {
    slug: 'portfolio-meta',
    title: 'Portfolio System Architecture',
    description_de: t('meta_desc', 'de'),
    description_en: t('meta_desc', 'en'),
    description_ar: t('meta_desc', 'ar'),
    badges: ['Architecture', 'Vanilla JS', 'DevOps', 'Case Study'],
    features: [],
    status: 'active',
    image_url: 'images/projects/portfolio-meta/logopf.png',
    github_url: 'https://github.com/yusef03/PortfolioBach',
    demo_url: null,
    subpage_url: 'projects/portfolio-meta.html',
    timeframe: null,
    role: null,
    is_hero: false,
    sort_order: 4,
  },
]

const GITHUB_CARD = {
  title_de: 'Mehr auf GitHub',
  title_en: 'More on GitHub',
  title_ar: 'المزيد على GitHub',
  text_de: 'Schau dir meine aktuellen Repositories, Experimente und Code-Snippets an.',
  text_en: 'Check out my latest repositories, experiments and code snippets.',
  text_ar: 'تصفح مستودعاتي الحديثة وتجاربي البرمجية.',
  btn_de: 'Zum Profil',
  btn_en: 'To Profile',
  btn_ar: 'إلى الملف الشخصي',
  url: 'https://github.com/yusef03',
}

async function supabaseInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${table} Insert Fehler ${res.status}: ${body}`)
  }
}

async function supabaseUpsert(table, rows, onConflict) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${table} Upsert Fehler ${res.status}: ${body}`)
  }
}

async function main() {
  console.log('🚀  Starte Migration: projects + archive_github_card')
  console.log(`    Supabase: ${SUPABASE_URL}`)

  // Bestehende Projekte löschen (sauberer Neustart)
  console.log('\n🗑   Lösche bestehende Projekte...')
  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=neq.00000000-0000-0000-0000-000000000000`, {
    method: 'DELETE',
    headers: HEADERS,
  })
  if (!delRes.ok) {
    const body = await delRes.text()
    // 404 ist ok wenn Tabelle leer ist
    if (!body.includes('relation') && !delRes.status === 404) {
      console.warn(`   Löschen-Warnung: ${delRes.status} ${body}`)
    }
  } else {
    console.log('   ✅ Bestehende Projekte gelöscht')
  }

  // Projekte einfügen
  console.log('\n📥  Füge 5 Projekte ein...')
  await supabaseInsert('projects', PROJECTS)
  console.log('   ✅ 5 Projekte erfolgreich eingefügt')

  // archive_github_card upserten
  console.log('\n📥  Upsert archive_github_card in settings...')
  await supabaseUpsert('settings', [{
    key: 'archive_github_card',
    value: GITHUB_CARD,
    updated_at: new Date().toISOString(),
  }], 'key')
  console.log('   ✅ archive_github_card gesetzt')

  console.log('\n✅  Migration abgeschlossen!')
  console.log('   Nächster Schritt: Bilder in Supabase Storage (project-images) hochladen')
  console.log('   Dann: node scripts/build-projects.mjs (in BETAPortfolioBach/) testen')
}

main().catch(e => {
  console.error('\n❌  Migration fehlgeschlagen:', e.message)
  process.exit(1)
})
