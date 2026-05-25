/**
 * Lazy-loaded Sentry module — only imports and initializes on first error.
 * This keeps @sentry/react (~200KB) out of the initial bundle.
 */

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

let sentryInitialized = false
let sentryModule: typeof import('@sentry/react') | null = null

async function initSentry() {
  if (!SENTRY_DSN || sentryInitialized) return
  sentryInitialized = true

  const Sentry = await import('@sentry/react')
  sentryModule = Sentry

  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.DEV ? 'development' : 'production',
    release: __APP_VERSION__,
    enabled: !import.meta.env.DEV,
  })
}

/**
 * Capture an exception via Sentry. Initializes Sentry on first call.
 */
export async function captureException(error: unknown, captureContext?: Parameters<typeof import('@sentry/react').captureException>[1]) {
  if (!SENTRY_DSN) return
  await initSentry()
  if (sentryModule) {
    sentryModule.captureException(error, captureContext)
  }
}

/**
 * Eagerly initialize Sentry if needed before any error occurs.
 * Typically not required — captureException auto-initializes on first error.
 */
export { initSentry }
