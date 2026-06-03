'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Badge, Button, Modal, Select, PageTransition } from '@/components/ui'
import { RefreshCw } from 'lucide-react'

type ActivityItem = {
  id: string; action: string; category: string
  status: 'success' | 'warning' | 'error' | 'info'
  message: string | null; details: Record<string, unknown>; error: string | null; created_at: string
}

const CATEGORIES = ['translations','maintenance','projects','bot_memory','media','roadmap','changelog','thoughts','auth','system'] as const
const STATUSES = ['success','warning','error','info'] as const

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  success: 'success', warning: 'warning', error: 'danger', info: 'info',
}

export default function ActivityLogPage() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<ActivityItem | null>(null)

  async function load() {
    setLoading(true)
    const url = new URL('/api/activity', window.location.origin)
    url.searchParams.set('limit', '200')
    if (category) url.searchParams.set('category', category)
    try {
      const res = await fetch(url.toString())
      const data = await res.json()
      setItems(data.items ?? [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [category])

  const filtered = status ? items.filter(i => i.status === status) : items

  return (
    <PageTransition>
      <PageHeader
        title="Activity Log"
        subtitle="Vollständige Historie aller Admin-Aktionen"
        actions={
          <Button variant="secondary" size="sm" loading={loading} icon={<RefreshCw size={13} />} onClick={load}>
            Neu laden
          </Button>
        }
      />

      {/* Filter */}
      <div className="flex gap-2 flex-wrap mb-4 items-center">
        <Select value={category} onChange={e => setCategory(e.target.value)} className="w-44">
          <option value="">Alle Kategorien</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={status} onChange={e => setStatus(e.target.value)} className="w-36">
          <option value="">Alle Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <span className="text-xs text-[var(--color-text-3)] ml-auto">{filtered.length} Einträge</span>
      </div>

      {/* Table */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-[var(--color-surface-2)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--color-text-3)] w-44">Zeitpunkt</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--color-text-3)] w-28">Kategorie</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--color-text-3)] w-24">Status</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--color-text-3)]">Nachricht</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-[var(--color-text-3)]">Lädt…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-[var(--color-text-3)]">Keine Einträge.</td></tr>
              )}
              {filtered.map(item => (
                <tr key={item.id} className="bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] transition-colors">
                  <td className="px-4 py-3 text-xs text-[var(--color-text-3)] font-mono">
                    {new Date(item.created_at).toLocaleString('de-DE')}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-2)]">{item.category}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[item.status] ?? 'default'}>{item.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-2)]">
                    {item.message ?? item.action}
                    {item.error && <span className="block text-[var(--color-danger)] mt-0.5 truncate">{item.error}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelected(item)}
                      className="text-xs text-[var(--color-accent)] hover:opacity-70 transition-opacity"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.action} width="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[selected.status] ?? 'default'} dot>{selected.status}</Badge>
              <span className="text-xs text-[var(--color-text-3)]">{selected.category} · {new Date(selected.created_at).toLocaleString('de-DE')}</span>
            </div>
            {selected.message && <p className="text-sm text-[var(--color-text-2)]">{selected.message}</p>}
            {selected.error && (
              <div className="rounded-[var(--radius-md)] border p-3" style={{ borderColor: 'rgba(239,68,68,.3)', background: 'rgba(239,68,68,.06)' }}>
                <div className="text-xs font-semibold text-[var(--color-danger)] mb-1">Fehler</div>
                <pre className="text-xs text-[var(--color-text-2)] overflow-x-auto font-mono">{selected.error}</pre>
              </div>
            )}
            {Object.keys(selected.details).length > 0 && (
              <>
                <div className="text-xs text-[var(--color-text-3)] font-medium">Details</div>
                <pre className="text-[10px] text-[var(--color-text-2)] bg-[var(--color-surface-0)] border border-[var(--color-border)] p-3 rounded-[var(--radius-sm)] overflow-x-auto font-mono">
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </>
            )}
            <div className="flex justify-end pt-1">
              <Button variant="primary" size="sm" onClick={() => setSelected(null)}>Schließen</Button>
            </div>
          </div>
        )}
      </Modal>
    </PageTransition>
  )
}
