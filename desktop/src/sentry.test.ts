import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sentryInitMock = vi.hoisted(() => vi.fn())
const sentryCaptureMock = vi.hoisted(() => vi.fn())
const browserTracingIntegrationMock = vi.hoisted(() => vi.fn(() => ({ name: 'browser-tracing' })))
const replayIntegrationMock = vi.hoisted(() => vi.fn((options: unknown) => ({ name: 'replay', options })))

vi.mock('@sentry/react', () => ({
  init: sentryInitMock,
  captureException: sentryCaptureMock,
  browserTracingIntegration: browserTracingIntegrationMock,
  replayIntegration: replayIntegrationMock,
}))

describe('sentry lazy loader', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    sentryInitMock.mockReset()
    sentryCaptureMock.mockReset()
    browserTracingIntegrationMock.mockClear()
    replayIntegrationMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('no-ops when no DSN is configured', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')

    const { captureException, initSentry } = await import('./sentry')

    await captureException(new Error('ignored error'))
    await initSentry()

    expect(sentryInitMock).not.toHaveBeenCalled()
    expect(sentryCaptureMock).not.toHaveBeenCalled()
  })

  it('initializes Sentry once and forwards captured exceptions when a DSN is present', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/1')

    const { captureException, initSentry } = await import('./sentry')

    const firstError = new Error('first failure')
    await captureException(firstError, { tags: { surface: 'editor' } })
    await captureException('second failure')
    await initSentry()

    expect(sentryInitMock).toHaveBeenCalledTimes(1)
    expect(browserTracingIntegrationMock).toHaveBeenCalledTimes(1)
    expect(replayIntegrationMock).toHaveBeenCalledWith({ maskAllText: true, blockAllMedia: true })
    expect(sentryCaptureMock).toHaveBeenNthCalledWith(1, firstError, { tags: { surface: 'editor' } })
    expect(sentryCaptureMock).toHaveBeenNthCalledWith(2, 'second failure', undefined)
  })

  it('uses the development environment branch when DEV is enabled', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/1')
    vi.stubEnv('DEV', true)

    const { initSentry } = await import('./sentry')

    await initSentry()

    expect(sentryInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'development',
        enabled: false,
      }),
    )
  })

  it('uses the production environment branch when DEV is disabled', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/1')
    vi.stubEnv('DEV', false)

    const { initSentry } = await import('./sentry')

    await initSentry()

    expect(sentryInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'production',
        enabled: true,
      }),
    )
  })
})
