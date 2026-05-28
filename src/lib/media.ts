/**
 * Media-Utilities (client-seitig).
 * Enthält: WebP-Konvertierung via Canvas, Dateigrößen-Formatierung,
 * Hilfsfunktionen für Supabase Storage.
 */

// ── WebP-Konvertierung ────────────────────────────────────────────────────────

/**
 * Konvertiert eine Bilddatei client-seitig via Canvas-API zu WebP.
 * SVGs und nicht-Rasterbilder werden unverändert zurückgegeben.
 * Bei Fehler (z.B. Canvas-Limit) wird die Originaldatei zurückgegeben.
 */
export async function convertToWebP(file: File, quality = 0.85): Promise<File> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  // Nur Rasterbilder konvertieren; SVG, PDF, Video etc. as-is
  if (!['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return file

  return new Promise<File>((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(file); return }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl)
            if (!blob || blob.size >= file.size) {
              // Wenn WebP größer wäre → Original behalten
              resolve(file)
              return
            }
            const webpName = file.name.replace(/\.[^.]+$/, '.webp')
            resolve(new File([blob], webpName, { type: 'image/webp' }))
          },
          'image/webp',
          quality
        )
      } catch {
        URL.revokeObjectURL(objectUrl)
        resolve(file)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }

    img.src = objectUrl
  })
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function getFileType(name: string): 'image' | 'vector' | 'video' | 'document' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
  if (ext === 'svg')                                        return 'vector'
  if (['mp4', 'webm', 'mov'].includes(ext))                 return 'video'
  if (['pdf', 'doc', 'docx'].includes(ext))                 return 'document'
  return 'other'
}

/** Supabase Storage Quota: 1 GB Free Tier */
export const STORAGE_QUOTA_BYTES = 1_073_741_824

/** Bucket-Labels für die UI */
export const BUCKET_LABELS: Record<string, { label: string; icon: string; accept: string; hint: string }> = {
  'documents':     { label: 'Dokumente',      icon: '📄', accept: '.pdf,.doc,.docx', hint: 'PDFs, Dokumente' },
  'project-images':{ label: 'Projekt-Bilder', icon: '🖼️', accept: 'image/*',          hint: 'Bilder (werden zu WebP konvertiert)' },
  'thoughts-media':{ label: 'Blog-Medien',    icon: '✍️', accept: 'image/*,.pdf',      hint: 'Blog-Bilder und Medien' },
}

/** Prüft ob eine Datei ein CV ist (Special Case für where-used) */
export function isCvFile(bucket: string, name: string): boolean {
  return bucket === 'documents' && name.toLowerCase() === 'cv.pdf'
}
