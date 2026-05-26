'use client'

import { useEffect, useState } from 'react'

type ActivityItem = {
  id: string
  action: string
  category: string
  status: 'success' | 'warning' | 'error' | 'info'
  message: string | null
  details: Record<string, unknown>
  error: string | null
  created_at: string
}

const CATEGORIES = ['translations', 'maintenance', 'projects', 'bot_memory', 'media', 'roadmap', 'changelog', 'thoughts', 'auth', 'system'] as const
const STATUSES = ['success', 'warning', 'error', 'info'] as const

const STATUS_BADGE = {
  success: 'bg-green-900/40 text-green-300 border-green-800',
  warning: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  error: 'bg-red-900/40 text-red-300 border-red-800',
  info: 'bg-blue-900/40 text-blue-300 border-blue-800',
} as const

export default function ActivityLogPage() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>('')
  const [status, setStatus] = useState<string>('')
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
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [category])

  const filtered = status ? items.filter(i => i.status === status) : items

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white">Activity Log</h2>
        <p className="text-gray-500 text-sm mt-1">Vollständige Historie aller Admin-Aktionen</p>
      </div>

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300"
        >
          <option value="">Alle Kategorien</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300"
        >
          <option value="">Alle Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="px-3 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">
          ↻ Neu laden
        </button>
        <span className="text-sm text-gray-500 ml-auto self-center">{filtered.length} Einträge</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left w-44">Zeitpunkt</th>
              <th className="px-4 py-3 text-left w-28">Kategorie</th>
              <th className="px-4 py-3 text-left w-24">Status</th>
              <th className="px-4 py-3 text-left">Nachricht</th>
              <th className="px-4 py-3 text-center w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Lädt…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Keine Einträge.</td></tr>
            )}
            {filtered.map(item => (
              <tr key={item.id} className="bg-gray-950 hover:bg-gray-900/50">
                <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                  {new Date(item.created_at).toLocaleString('de-DE')}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{item.category}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${STATUS_BADGE[item.status]}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-300">
                  {item.message ?? item.action}
                  {item.error && <span className="block text-red-400 mt-0.5 truncate">{item.error}</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => setSelected(item)} className="text-xs text-purple-400 hover:text-purple-300">
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${STATUS_BADGE[selected.status]}`}>
                {selected.status}
              </span>
              <h3 className="text-lg font-bold text-white">{selected.action}</h3>
            </div>
            <p className="text-gray-400 text-xs mb-4">{selected.category} · {new Date(selected.created_at).toLocaleString('de-DE')}</p>
            {selected.message && <p className="text-gray-200 text-sm mb-3">{selected.message}</p>}
            {selected.error && (
              <div className="bg-red-950/40 border border-red-800 rounded-lg p-3 mb-3">
                <div className="text-xs text-red-300 font-semibold mb-1">Fehler</div>
                <pre className="text-xs text-red-200 overflow-x-auto">{selected.error}</pre>
              </div>
            )}
            {Object.keys(selected.details).length > 0 && (
              <>
                <div className="text-xs text-gray-500 mb-1">Details</div>
                <pre className="text-[10px] text-gray-400 bg-black/40 p-3 rounded overflow-x-auto">
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={() => setSelected(null)} className="px-3 py-1.5 text-xs rounded-lg bg-purple-600 hover:bg-purple-500 text-white">
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
