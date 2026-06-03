'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/components/Toast'
import { PageHeader, Button, Input, Select, Modal, Badge, PageTransition } from '@/components/ui'
import { Globe, Languages, Zap, Rocket, RotateCcw, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

async function log(payload: { action: string; status: 'success'|'warning'|'error'|'info'; message?: string; details?: Record<string,unknown>; error?: string }) {
  try { await fetch('/api/activity', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...payload, category:'translations'}) }) } catch { /**/ }
}

type Translation = { id: string; key: string; de: string; en: string; ar: string; updated_at: string }
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type PublishStatus = 'idle' | 'publishing' | 'success' | 'error'
type FilterLang = 'all' | 'missing_en' | 'missing_ar' | 'missing_any'

const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
function isMissing(v: string) { return !v || v.trim() === '' }

function StatCard({ icon: Icon, label, value, accent = false, warn = false }: { icon: React.ElementType; label: string; value: number | string; accent?: boolean; warn?: boolean }) {
  return (
    <div
      className="rounded-[var(--radius-lg)] border p-4 flex items-center gap-4"
      style={{
        background: accent ? 'var(--gradient-aurora-soft)' : warn && Number(value) > 0 ? 'rgba(245,158,11,.06)' : 'var(--color-surface-1)',
        borderColor: accent ? 'rgba(157,0,255,.25)' : warn && Number(value) > 0 ? 'rgba(245,158,11,.3)' : 'var(--color-border)',
      }}
    >
      <div className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
        style={{ background: accent ? 'var(--gradient-aurora)' : warn && Number(value) > 0 ? 'rgba(245,158,11,.12)' : 'var(--color-surface-2)' }}>
        <Icon size={16} strokeWidth={1.75} style={{ color: accent ? '#fff' : warn && Number(value) > 0 ? 'var(--color-warning)' : 'var(--color-text-3)' }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-[var(--color-text-1)] leading-none">{value}</p>
        <p className="text-xs text-[var(--color-text-3)] mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default function TranslationsPage() {
  const [rows, setRows] = useState<Translation[]>([])
  const [filtered, setFiltered] = useState<Translation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLang, setFilterLang] = useState<FilterLang>('all')
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [translating, setTranslating] = useState<Record<string, boolean>>({})
  const [bulkTranslating, setBulkTranslating] = useState(false)
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle')
  const [publishMsg, setPublishMsg] = useState('')
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const toast = useToast()

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('translations').select('*').order('key', { ascending: true })
    if (!error) setRows(data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    let result = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(r => r.key.toLowerCase().includes(q) || r.de.toLowerCase().includes(q) || r.en.toLowerCase().includes(q))
    }
    if (filterLang === 'missing_en') result = result.filter(r => isMissing(r.en))
    if (filterLang === 'missing_ar') result = result.filter(r => isMissing(r.ar))
    if (filterLang === 'missing_any') result = result.filter(r => isMissing(r.en) || isMissing(r.ar))
    setFiltered(result)
  }, [rows, search, filterLang])

  const handleChange = (id: string, field: 'de'|'en'|'ar', value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    clearTimeout(saveTimers.current[id])
    setSaveStatus(prev => ({ ...prev, [id]: 'saving' }))
    saveTimers.current[id] = setTimeout(() => save(id, field, value), 800)
  }

  const save = async (id: string, field: string, value: string) => {
    const row = rows.find(r => r.id === id)
    const { error } = await supabase.from('translations').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id)
    setSaveStatus(prev => ({ ...prev, [id]: error ? 'error' : 'saved' }))
    setTimeout(() => setSaveStatus(prev => ({ ...prev, [id]: 'idle' })), 2000)
    if (error) { toast.error('Speichern fehlgeschlagen', { detail: error.message }); log({ action:'translation_update_failed', status:'error', message:`Fehler bei "${row?.key}"`, error: error.message, details:{key:row?.key, field} }) }
    else { log({ action:'translation_updated', status:'success', message:`${field.toUpperCase()} aktualisiert: ${row?.key}`, details:{key:row?.key, field} }) }
  }

  const translateRow = async (row: Translation) => {
    if (!row.de.trim()) return
    setTranslating(prev => ({ ...prev, [row.id]: true }))
    try {
      const res = await fetch('/api/translate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: row.de, both: true }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Übersetzungsfehler')
      await supabase.from('translations').update({ en: data.en, ar: data.ar, updated_at: new Date().toISOString() }).eq('id', row.id)
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, en: data.en, ar: data.ar } : r))
      setSaveStatus(prev => ({ ...prev, [row.id]: 'saved' }))
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [row.id]: 'idle' })), 2000)
      toast.success(`Übersetzt: ${row.key}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Fehler'
      toast.error('Übersetzungsfehler', { detail: msg })
    } finally { setTranslating(prev => ({ ...prev, [row.id]: false })) }
  }

  const translateAllMissing = async () => {
    const missing = rows.filter(r => r.de.trim() && (isMissing(r.en) || isMissing(r.ar)))
    if (missing.length === 0) { toast.info('Keine fehlenden Übersetzungen.'); return }
    setBulkTranslating(true)
    toast.info(`Starte Bulk-Übersetzung für ${missing.length} Keys…`)
    let done = 0, failed = 0
    for (const row of missing) {
      try {
        const res = await fetch('/api/translate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: row.de, both: true }) })
        const data = await res.json()
        if (res.ok) { await supabase.from('translations').update({ en: data.en, ar: data.ar, updated_at: new Date().toISOString() }).eq('id', row.id); setRows(prev => prev.map(r => r.id === row.id ? { ...r, en: data.en, ar: data.ar } : r)); done++ }
        else failed++
      } catch { failed++ }
    }
    setBulkTranslating(false)
    failed === 0 ? toast.success(`${done} Übersetzungen erzeugt`) : toast.warning(`${done} erzeugt, ${failed} fehlgeschlagen`)
    log({ action:'translations_bulk', status: failed === 0 ? 'success' : 'warning', message:`Bulk: ${done} erfolgreich, ${failed} fehlgeschlagen`, details:{total:missing.length,done,failed} })
  }

  const publish = async () => {
    setShowPublishModal(false); setPublishStatus('publishing'); setPublishMsg('GitHub Action wird gestartet…')
    try {
      const res = await fetch('/api/publish', { method:'POST' }); const data = await res.json()
      if (data.ok) { setPublishStatus('success'); setPublishMsg(data.message); toast.success('Publish gestartet', { detail:'Live in ~1-2 Min auf yusefbach.de' }); log({action:'publish_triggered',status:'success',message:'Translations Publish gestartet'}) }
      else { const msg = data.message||data.error||'Unbekannter Fehler'; setPublishStatus('error'); setPublishMsg(msg); toast.error('Publish fehlgeschlagen', { detail:msg }) }
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Netzwerkfehler'; setPublishStatus('error'); setPublishMsg(msg); toast.error('Netzwerkfehler', { detail:msg }) }
    setTimeout(() => { setPublishStatus('idle'); setPublishMsg('') }, 8000)
  }

  const missingEn = rows.filter(r => isMissing(r.en)).length
  const missingAr = rows.filter(r => isMissing(r.ar)).length
  const missingAny = rows.filter(r => isMissing(r.en) || isMissing(r.ar)).length

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Translations"
        subtitle="Portfolio-Texte in DE / EN / AR verwalten"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" loading={bulkTranslating} icon={<RotateCcw size={13} />} onClick={translateAllMissing}>
              Fehlende übersetzen
            </Button>
            <Button variant="primary" size="sm" loading={publishStatus === 'publishing'} icon={<Rocket size={13} />} onClick={() => setShowPublishModal(true)}>
              Publish
            </Button>
          </div>
        }
      />

      {/* Publish Status */}
      {publishMsg && (
        <div className="rounded-[var(--radius-md)] border px-4 py-3 text-sm flex items-center gap-2"
          style={{
            borderColor: publishStatus === 'success' ? 'rgba(34,197,94,.3)' : publishStatus === 'error' ? 'rgba(239,68,68,.3)' : 'rgba(0,229,255,.3)',
            background: publishStatus === 'success' ? 'rgba(34,197,94,.06)' : publishStatus === 'error' ? 'rgba(239,68,68,.06)' : 'rgba(0,229,255,.06)',
            color: publishStatus === 'success' ? 'var(--color-success)' : publishStatus === 'error' ? 'var(--color-danger)' : 'var(--color-accent)',
          }}
        >
          {publishMsg}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Globe}     label="Gesamt Keys"   value={rows.length}  accent />
        <StatCard icon={Languages} label="DE vollständig" value={rows.filter(r => !isMissing(r.de)).length} />
        <StatCard icon={Languages} label="EN fehlt"      value={missingEn}    warn />
        <StatCard icon={Languages} label="AR fehlt"      value={missingAr}    warn />
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2 flex-wrap">
        <Input
          type="text"
          placeholder="Key oder Text suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
        <Select value={filterLang} onChange={e => setFilterLang(e.target.value as FilterLang)} className="w-52">
          <option value="all">Alle ({rows.length})</option>
          <option value="missing_en">EN fehlt ({missingEn})</option>
          <option value="missing_ar">AR fehlt ({missingAr})</option>
          <option value="missing_any">Irgendwas fehlt ({missingAny})</option>
        </Select>
        {(search || filterLang !== 'all') && (
          <Badge variant="accent">{filtered.length} Treffer</Badge>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-3)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Lädt {rows.length > 0 ? rows.length : ''} Keys…</span>
        </div>
      ) : (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] overflow-hidden">
          {/* Sticky Header */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--color-border)]" style={{ background: 'var(--color-surface-2)' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider w-52">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider">🇩🇪 DE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider">🇬🇧 EN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider">🇸🇦 AR</th>
                  <th className="px-4 py-3 w-14" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-16 text-center text-sm text-[var(--color-text-3)]">Keine Einträge gefunden.</td></tr>
                )}
                {filtered.map((row, i) => {
                  const status = saveStatus[row.id] || 'idle'
                  const isTranslating = translating[row.id]
                  const isExpanded = expandedKey === row.id
                  const hasLongText = row.de.length > 80
                  const isEvenRow = i % 2 === 0

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--color-border)] last:border-0 transition-colors"
                      style={{ background: isEvenRow ? 'var(--color-surface-1)' : 'var(--color-surface-0)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = isEvenRow ? 'var(--color-surface-1)' : 'var(--color-surface-0)')}
                    >
                      {/* Key */}
                      <td className="px-4 py-3 align-top">
                        <code className="text-[11px] font-mono text-[var(--color-accent)] break-all leading-relaxed">{row.key}</code>
                        <div className="mt-1 h-4">
                          {status === 'saving' && <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-3)]"><Loader2 size={10} className="animate-spin" />speichert…</span>}
                          {status === 'saved'  && <span className="flex items-center gap-1 text-[10px] text-[var(--color-success)]"><CheckCircle2 size={10} />gespeichert</span>}
                          {status === 'error'  && <span className="flex items-center gap-1 text-[10px] text-[var(--color-danger)]"><XCircle size={10} />Fehler</span>}
                        </div>
                      </td>

                      {/* DE */}
                      <td className="px-4 py-3 align-top">
                        {hasLongText && !isExpanded ? (
                          <div className="text-xs text-[var(--color-text-2)] cursor-pointer" onDoubleClick={() => setExpandedKey(row.id)}>
                            {row.de.substring(0, 80)}…
                            <span className="text-[var(--color-text-3)] ml-1 text-[10px]">[Doppelklick]</span>
                          </div>
                        ) : (
                          <textarea value={row.de} onChange={e => handleChange(row.id, 'de', e.target.value)} onBlur={() => isExpanded && setExpandedKey(null)}
                            rows={isExpanded ? 6 : 2}
                            className="w-full bg-transparent text-xs text-[var(--color-text-2)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50 rounded-[var(--radius-sm)] p-1 transition-shadow"
                          />
                        )}
                      </td>

                      {/* EN */}
                      <td className="px-4 py-3 align-top">
                        <textarea value={row.en} onChange={e => handleChange(row.id, 'en', e.target.value)} rows={2} placeholder="—"
                          className={`w-full bg-transparent text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50 rounded-[var(--radius-sm)] p-1 transition-shadow ${isMissing(row.en) ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-2)]'}`}
                        />
                      </td>

                      {/* AR */}
                      <td className="px-4 py-3 align-top">
                        <textarea value={row.ar} onChange={e => handleChange(row.id, 'ar', e.target.value)} rows={2} placeholder="—" dir="rtl"
                          className={`w-full bg-transparent text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50 rounded-[var(--radius-sm)] p-1 transition-shadow ${isMissing(row.ar) ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-2)]'}`}
                        />
                      </td>

                      {/* Action */}
                      <td className="px-3 py-3 align-top">
                        <button onClick={() => translateRow(row)} disabled={isTranslating || !row.de.trim()} title="DE → EN + AR"
                          className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] disabled:opacity-30 transition-all"
                        >
                          {isTranslating ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      <Modal open={showPublishModal} onClose={() => setShowPublishModal(false)} title="Translations publishen?" width="md">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-2)]">
            GitHub Actions startet und erzeugt <code className="text-[var(--color-accent)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded text-xs">lang/de.json</code>, <code className="text-[var(--color-accent)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded text-xs">lang/en.json</code> und <code className="text-[var(--color-accent)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded text-xs">lang/ar.json</code> aus Supabase. In ~1–2 Minuten live auf yusefbach.de.
          </p>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={() => setShowPublishModal(false)}>Abbrechen</Button>
            <Button variant="primary" size="sm" icon={<Rocket size={13} />} onClick={publish}>Ja, publishen</Button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  )
}
