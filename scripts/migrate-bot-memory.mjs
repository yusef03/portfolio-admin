import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const content = readFileSync(
  join(__dirname, '../../BETAPortfolioBach/yusef_brain.md'),
  'utf-8'
)

const { error } = await supabase
  .from('settings')
  .upsert({
    key: 'bot_memory',
    value: { content, version: '2.6.0', migrated_at: new Date().toISOString() },
    updated_at: new Date().toISOString()
  })

if (error) console.error('Migration fehlgeschlagen:', error)
else console.log('bot_memory erfolgreich migriert —', content.length, 'Zeichen')
