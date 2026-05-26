'use client'

import { useState } from 'react'
import type { ServiceHealth, ServiceStatus } from '@/lib/health'

const STATUS_STYLES: Record<ServiceStatus, { dot: string; border: string; label: string }> = {
  healthy:  { dot: 'bg-green-500',  border: 'border-green-800/50',  label: 'OK' },
  degraded: { dot: 'bg-yellow-500', border: 'border-yellow-800/50', label: 'Warnung' },
  down:     { dot: 'bg-red-500',    border: 'border-red-800/50',    label: 'Fehler' },
  unknown:  { dot: 'bg-gray-500',   border: 'border-gray-800/50',   label: 'Unbekannt' },
}

const STATUS_EMOJI: Record<ServiceStatus, string> = {
  healthy: '🟢', degraded: '🟡', down: '🔴', unknown: '⚪',
}

export function HealthCard({ service }: { service: ServiceHealth }) {
  const [showDetails, setShowDetails] = useState(false)
  const s = STATUS_STYLES[service.status]
  const interactive = service.status !== 'healthy' || service.detailsUrl

  return (
    <>
      <button
        onClick={() => interactive && setShowDetails(true)}
        disabled={!interactive}
        className={`text-left bg-gray-950 border ${s.border} rounded-xl p-3 transition-colors ${interactive ? 'hover:bg-gray-900 cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full ${s.dot}`}></span>
          <span className="text-white font-medium text-sm">{service.name}</span>
          {service.latencyMs !== undefined && (
            <span className="ml-auto text-[10px] text-gray-500 font-mono">{service.latencyMs}ms</span>
          )}
        </div>
        <div className="text-xs text-gray-400">
          {service.message ?? s.label}
          {service.meta && service.status === 'healthy' && (
            <MetaInline meta={service.meta} />
          )}
        </div>
      </button>

      {showDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={() => setShowDetails(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{STATUS_EMOJI[service.status]}</span>
              <h3 className="text-lg font-bold text-white">{service.name}</h3>
            </div>
            {service.message && (
              <p className="text-gray-300 text-sm mb-3">{service.message}</p>
            )}
            {service.hint && (
              <div className="bg-purple-950/30 border border-purple-800 rounded-lg p-3 mb-3">
                <div className="text-xs text-purple-300 font-semibold mb-1">💡 Was tun?</div>
                <div className="text-xs text-purple-200">{service.hint}</div>
              </div>
            )}
            {service.meta && Object.keys(service.meta).length > 0 && (
              <details className="mb-3">
                <summary className="text-xs text-gray-400 cursor-pointer">Details</summary>
                <pre className="text-[10px] text-gray-500 bg-black/40 p-2 rounded mt-2 overflow-x-auto">{JSON.stringify(service.meta, null, 2)}</pre>
              </details>
            )}
            <div className="flex gap-2 justify-end mt-4">
              {service.detailsUrl && (
                <a href={service.detailsUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200">
                  Öffnen ↗
                </a>
              )}
              <button onClick={() => setShowDetails(false)} className="px-3 py-1.5 text-xs rounded-lg bg-purple-600 hover:bg-purple-500 text-white">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MetaInline({ meta }: { meta: Record<string, unknown> }) {
  // Spezielle Inline-Darstellungen für bekannte Meta-Felder
  if ('percent' in meta && 'used' in meta && 'limit' in meta) {
    return <span className="ml-1 text-gray-500">· {formatNumber(meta.used as number)} / {formatNumber(meta.limit as number)}</span>
  }
  if ('remaining' in meta && 'limit' in meta) {
    return <span className="ml-1 text-gray-500">· {String(meta.remaining)}/{String(meta.limit)}</span>
  }
  return null
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}
