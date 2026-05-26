/**
 * DeepL API Client
 * Nur serverseitig verwenden — API Key darf nie im Browser landen.
 * Docs: https://developers.deepl.com/docs/api-reference/translate
 */

export type DeepLTargetLang = 'EN-GB' | 'AR'

interface DeepLResponse {
  translations: Array<{
    detected_source_language: string
    text: string
  }>
}

/**
 * Übersetzt einen Text von DE nach targetLang via DeepL API.
 * Unterstützt HTML-Tags (tag_handling=html) — <br>, <strong>, <span> bleiben erhalten.
 */
export async function translate(
  text: string,
  targetLang: DeepLTargetLang,
  sourceLang: 'DE' = 'DE'
): Promise<string> {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) throw new Error('DEEPL_API_KEY nicht gesetzt')

  // Free-Tier nutzt api-free.deepl.com, bezahlte api.deepl.com
  const baseUrl = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com'
    : 'https://api.deepl.com'

  const res = await fetch(`${baseUrl}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      source_lang: sourceLang,
      target_lang: targetLang,
      tag_handling: 'html',        // <br>, <strong>, <span> werden respektiert
      preserve_formatting: true,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DeepL Fehler ${res.status}: ${body}`)
  }

  const data: DeepLResponse = await res.json()
  return data.translations[0]?.text ?? ''
}

/**
 * Übersetzt einen Text in beide Zielsprachen (EN + AR) gleichzeitig.
 */
export async function translateBoth(
  deText: string
): Promise<{ en: string; ar: string }> {
  const [en, ar] = await Promise.all([
    translate(deText, 'EN-GB'),
    translate(deText, 'AR'),
  ])
  return { en, ar }
}

/**
 * Prüft ob der DeepL API Key konfiguriert und erreichbar ist.
 */
export async function checkDeepLHealth(): Promise<{ ok: boolean; usage?: { character_count: number; character_limit: number } }> {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) return { ok: false }

  const baseUrl = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com'
    : 'https://api.deepl.com'

  try {
    const res = await fetch(`${baseUrl}/v2/usage`, {
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
    })
    if (!res.ok) return { ok: false }
    const data = await res.json()
    return { ok: true, usage: data }
  } catch {
    return { ok: false }
  }
}
