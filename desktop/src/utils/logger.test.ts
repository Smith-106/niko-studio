import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('delegates every method to console in dev mode', async () => {
    vi.stubEnv('DEV', true)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    const { logger } = await import('./logger')
    logger.log('log')
    logger.warn('warn')
    logger.error('error')
    logger.debug('debug')
    logger.info('info')

    expect(logSpy).toHaveBeenCalledWith('log')
    expect(warnSpy).toHaveBeenCalledWith('warn')
    expect(errorSpy).toHaveBeenCalledWith('error')
    expect(debugSpy).toHaveBeenCalledWith('debug')
    expect(infoSpy).toHaveBeenCalledWith('info')
  })

  it('keeps error logging enabled while no-oping non-error methods outside dev mode', async () => {
    vi.stubEnv('DEV', false)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    const { logger } = await import('./logger')
    logger.log('hidden-log')
    logger.warn('hidden-warn')
    logger.error('visible-error')
    logger.debug('hidden-debug')
    logger.info('hidden-info')

    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith('visible-error')
    expect(debugSpy).not.toHaveBeenCalled()
    expect(infoSpy).not.toHaveBeenCalled()
  })
})
