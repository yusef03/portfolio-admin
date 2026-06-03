'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export interface ToastInput {
  type?: ToastType
  title: string
  detail?: string
  durationMs?: number    // 0 = bleibt bis manuell geschlossen
}

interface Toast extends Required<Omit<ToastInput, 'detail'>> {
  id: string
  detail?: string
  createdAt: number
}

interface ToastContextValue {
  push: (t: ToastInput) => string
  dismiss: (id: string) => void
  success: (title: string, opts?: Omit<ToastInput, 'title' | 'type'>) => string
  warning: (title: string, opts?: Omit<ToastInput, 'title' | 'type'>) => string
  error: (title: string, opts?: Omit<ToastInput, 'title' | 'type'>) => string
  info: (title: string, opts?: Omit<ToastInput, 'title' | 'type'>) => string
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3500,
  info: 4500,
  warning: 6500,
  error: 0,  // bleibt bis Click
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((input: ToastInput): string => {
    const id = crypto.randomUUID()
    const type = input.type ?? 'info'
    const durationMs = input.durationMs ?? DEFAULT_DURATION[type]
    const toast: Toast = {
      id,
      type,
      title: input.title,
      detail: input.detail,
      durationMs,
      createdAt: Date.now(),
    }
    setToasts(prev => {
      const next = [...prev, toast]
      // Max 5 sichtbar — ältere rausschmeißen
      return next.slice(-5)
    })
    if (durationMs > 0) {
      setTimeout(() => dismiss(id), durationMs)
    }
    return id
  }, [dismiss])

  const value: ToastContextValue = {
    push,
    dismiss,
    success: (title, opts) => push({ ...opts, type: 'success', title }),
    warning: (title, opts) => push({ ...opts, type: 'warning', title }),
    error: (title, opts) => push({ ...opts, type: 'error', title }),
    info: (title, opts) => push({ ...opts, type: 'info', title }),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast muss innerhalb von <ToastProvider> verwendet werden')
  return ctx
}

// ─── Viewport ─────────────────────────────────────────────────────────────────

type ToastMeta = { border: string; iconColor: string; icon: string; labelColor: string }

const TYPE_META: Record<ToastType, ToastMeta> = {
  success: { border: 'var(--color-success)', iconColor: 'var(--color-success)', icon: '✓', labelColor: 'var(--color-success)' },
  warning: { border: 'var(--color-warning)', iconColor: 'var(--color-warning)', icon: '⚠', labelColor: 'var(--color-warning)' },
  error:   { border: 'var(--color-danger)',  iconColor: 'var(--color-danger)',  icon: '✕', labelColor: 'var(--color-danger)' },
  info:    { border: 'var(--color-accent)',  iconColor: 'var(--color-accent)',  icon: 'ℹ', labelColor: 'var(--color-accent)' },
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const m = TYPE_META[toast.type]
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div
      role="alert"
      style={{ borderColor: `${m.border}55` }}
      className={`
        pointer-events-auto
        bg-[var(--color-surface-1)] backdrop-blur-md
        border rounded-[var(--radius-lg)] px-4 py-3 shadow-lg
        transition-all duration-200
        ${mounted ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'}
      `}
    >
      <div className="flex items-start gap-3">
        <span className="text-sm font-bold shrink-0 mt-0.5" style={{ color: m.iconColor }}>{m.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--color-text-1)] break-words">{toast.title}</div>
          {toast.detail && <div className="text-xs text-[var(--color-text-2)] mt-0.5 break-words">{toast.detail}</div>}
        </div>
        <button
          onClick={onDismiss}
          className="text-xs text-[var(--color-text-3)] hover:text-[var(--color-text-1)] shrink-0 transition-colors"
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
