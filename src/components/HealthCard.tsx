'use client'

import { useState } from 'react'
import { CheckCircle, AlertTriangle, XCircle, HelpCircle, ExternalLink } from 'lucide-react'
import { Modal, Button, Badge } from '@/components/ui'
import type { ServiceHealth, ServiceStatus } from '@/lib/health'

const STATUS_CONFIG: Record<ServiceStatus, {
  dotClass: string
  borderVar: string
  bgVar: string
  icon: React.ReactNode
  label: string
}> = {
  healthy:  {
    dotClass: 'bg-[var(--color-success)]',
    borderVar: 'var(--color-success)',
    bgVar: 'transparent',
    icon: <CheckCircle size={14} strokeWidth={2} className="text-[var(--color-success)]" />,
    label: 'OK',
  },
  degraded: {
    dotClass: 'bg-[var(--color-warning)]',
    borderVar: 'var(--color-warning)',
    bgVar: 'transparent',
    icon: <AlertTriangle size={14} strokeWidth={2} className="text-[var(--color-warning)]" />,
    label: 'Warnung',
  },
  down: {
    dotClass: 'bg-[var(--color-danger)]',
    borderVar: 'var(--color-danger)',
    bgVar: 'transparent',
    icon: <XCircle size={14} strokeWidth={2} className="text-[var(--color-danger)]" />,
    label: 'Fehler',
  },
  unknown: {
    dotClass: 'bg-[var(--color-text-3)]',
    borderVar: 'var(--color-border)',
    bgVar: 'transparent',
    icon: <HelpCircle size={14} strokeWidth={2} className="text-[var(--color-text-3)]" />,
    label: 'Unbekannt',
  },
}

const STATUS_BADGE_VARIANT: Record<ServiceStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  healthy: 'success', degraded: 'warning', down: 'danger', unknown: 'default',
}

export function HealthCard({ service }: { service: ServiceHealth }) {
  const [showDetails, setShowDetails] = useState(false)
  const cfg = STATUS_CONFIG[service.status]
  const interactive = service.status !== 'healthy' || service.detailsUrl

  return (
    <>
      <button
        onClick={() => interactive && setShowDetails(true)}
        disabled={!interactive}
        style={{ borderColor: `${cfg.borderVar}33` }}
        className={`
          text-left w-full bg-[var(--color-surface-0)] border rounded-[var(--radius-lg)] p-3.5
          transition-all duration-200
          ${interactive
            ? 'hover:bg-[var(--color-surface-2)] hover:shadow-[var(--glow-brand)] cursor-pointer hover:-translate-y-0.5'
            : 'cursor-default'
          }
        `}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotClass} ${service.status === 'degraded' || service.status === 'down' ? 'animate-pulse' : ''}`} />
          <span className="text-[var(--color-text-1)] font-medium text-sm flex-1 truncate">{service.name}</span>
          {service.latencyMs !== undefined && (
            <span className="text-[10px] text-[var(--color-text-3)] font-mono shrink-0">{service.latencyMs}ms</span>
          )}
        </div>
        <div className="text-xs text-[var(--color-text-2)] flex items-center gap-1.5">
          {cfg.icon}
          <span>{service.message ?? cfg.label}</span>
          {service.meta && service.status === 'healthy' && <MetaInline meta={service.meta} />}
        </div>
      </button>

      <Modal
        open={showDetails}
        onClose={() => setShowDetails(false)}
        title={service.name}
        width="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE_VARIANT[service.status]} dot>
              {STATUS_CONFIG[service.status].label}
            </Badge>
            {service.latencyMs !== undefined && (
              <span className="text-xs text-[var(--color-text-3)] font-mono">{service.latencyMs}ms</span>
            )}
          </div>

          {service.message && (
            <p className="text-sm text-[var(--color-text-2)]">{service.message}</p>
          )}

          {service.hint && (
            <div
              className="rounded-[var(--radius-md)] p-3 border"
              style={{
                background: 'rgba(10,132,255,0.06)',
                borderColor: 'rgba(10,132,255,0.25)',
              }}
            >
              <div className="text-xs font-semibold text-[var(--color-brand-light)] mb-1">💡 Was tun?</div>
              <div className="text-xs text-[var(--color-text-2)]">{service.hint}</div>
            </div>
          )}

          {service.meta && Object.keys(service.meta).length > 0 && (
            <details>
              <summary className="text-xs text-[var(--color-text-3)] cursor-pointer">Details</summary>
              <pre className="text-[10px] text-[var(--color-text-3)] bg-[var(--color-surface-0)] p-2 rounded mt-2 overflow-x-auto border border-[var(--color-border)]">
                {JSON.stringify(service.meta, null, 2)}
              </pre>
            </details>
          )}

          <div className="flex gap-2 justify-end pt-1">
            {service.detailsUrl && (
              <Button
                variant="secondary" size="sm"
                icon={<ExternalLink size={12} />}
                onClick={() => window.open(service.detailsUrl, '_blank')}
              >
                Öffnen
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => setShowDetails(false)}>OK</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function MetaInline({ meta }: { meta: Record<string, unknown> }) {
  if ('percent' in meta && 'used' in meta && 'limit' in meta)
    return <span className="text-[var(--color-text-3)]">· {fmt(meta.used as number)} / {fmt(meta.limit as number)}</span>
  if ('remaining' in meta && 'limit' in meta)
    return <span className="text-[var(--color-text-3)]">· {String(meta.remaining)}/{String(meta.limit)}</span>
  return null
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}
