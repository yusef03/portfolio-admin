'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
  context?: string  // z.B. 'translations-page'
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', this.props.context, error, info)
    // Fire-and-forget: ins Activity-Log schreiben
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'react_error',
        category: 'system',
        status: 'error',
        message: this.props.context ? `Fehler in: ${this.props.context}` : 'React Component Fehler',
        error: error.message,
        details: { stack: error.stack?.substring(0, 1000), componentStack: info.componentStack?.substring(0, 500) },
      }),
    }).catch(() => { /* silent */ })
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset)
      return (
        <div
          className="rounded-[var(--radius-lg)] border p-6 m-4"
          style={{ borderColor: `${`var(--color-danger)`}44`, background: `${`var(--color-danger)`}08` }}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5">⚠️</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-[var(--color-danger)] font-bold mb-1 text-sm">Etwas ist schiefgelaufen</h3>
              <p className="text-[var(--color-text-2)] text-xs mb-3">
                {this.props.context ? `In: ${this.props.context}` : 'Eine Komponente ist abgestürzt.'}
              </p>
              <pre className="text-xs text-[var(--color-text-2)] bg-[var(--color-surface-0)] border border-[var(--color-border)] p-3 rounded-[var(--radius-sm)] overflow-x-auto max-h-32 overflow-y-auto font-mono">
                {this.state.error.message}
              </pre>
              <div className="flex gap-2 mt-4 flex-wrap">
                <button
                  onClick={this.reset}
                  className="px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--color-danger)]/15 hover:bg-[var(--color-danger)]/25 text-[var(--color-danger)] border border-[var(--color-danger)]/25 transition-colors"
                >
                  Erneut versuchen
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(`${this.state.error?.message}\n\n${this.state.error?.stack}`)}
                  className="px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-2)] border border-[var(--color-border)] transition-colors"
                >
                  Fehler kopieren
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-2)] border border-[var(--color-border)] transition-colors"
                >
                  Seite neu laden
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
