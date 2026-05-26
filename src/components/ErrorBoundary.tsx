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
        <div className="rounded-xl border border-red-800 bg-red-950/40 p-6 m-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-red-300 font-bold mb-1">Etwas ist schiefgelaufen</h3>
              <p className="text-red-400 text-sm mb-3">
                {this.props.context ? `In: ${this.props.context}` : 'Eine Komponente ist abgestürzt.'}
              </p>
              <pre className="text-xs text-red-200 bg-black/40 p-3 rounded overflow-x-auto max-h-32 overflow-y-auto">
                {this.state.error.message}
              </pre>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={this.reset}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-800 hover:bg-red-700 text-white"
                >
                  Erneut versuchen
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${this.state.error?.message}\n\n${this.state.error?.stack}`)
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200"
                >
                  Fehler kopieren
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200"
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
