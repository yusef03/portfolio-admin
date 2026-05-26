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

const TYPE_STYLES: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: 'bg-green-950/90', border: 'border-green-700', icon: '✅', text: 'text-green-200' },
  warning: { bg: 'bg-yellow-950/90', border: 'border-yellow-700', icon: '⚠️', text: 'text-yellow-200' },
  error:   { bg: 'bg-red-950/90', border: 'border-red-700', icon: '🔴', text: 'text-red-200' },
  info:    { bg: 'bg-blue-950/90', border: 'border-blue-700', icon: 'ℹ️', text: 'text-blue-200' },
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
  const s = TYPE_STYLES[toast.type]
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div
      className={`pointer-events-auto ${s.bg} ${s.border} ${s.text} backdrop-blur-sm border rounded-xl px-4 py-3 shadow-lg transition-all duration-200 ${mounted ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'}`}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium break-words">{toast.title}</div>
          {toast.detail && <div className="text-xs opacity-80 mt-0.5 break-words">{toast.detail}</div>}
        </div>
        <button
          onClick={onDismiss}
          className="text-xs opacity-60 hover:opacity-100 shrink-0"
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
