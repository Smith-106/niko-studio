import { Component, type ReactNode } from 'react'
import { translations } from '../i18n/translations'
import { useSettingsStore } from '../stores/settingsStore'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

function getT() {
  const lang = (useSettingsStore.getState().settings.language || 'zh') as 'zh' | 'en'
  return translations[lang]
}

/**
 * Error boundary with recovery UI.
 * Adapted from Cherry Studio's ErrorBoundary pattern.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const t = getT()

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-dark-text mb-2">
            {t.errorBoundaryTitle}
          </h3>
          <p className="text-sm text-gray-500 dark:text-dark-text-muted mb-4 max-w-md">
            {this.state.error?.message || t.errorBoundaryDescription}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-500 transition-colors"
            >
              {t.errorBoundaryTryAgain}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-dark-surface text-gray-700 dark:text-dark-text rounded-lg hover:bg-gray-200 dark:hover:bg-dark-surface2 border border-gray-200 dark:border-dark-border transition-colors"
            >
              {t.errorBoundaryReload}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
