import { beforeEach, describe, expect, it, vi } from 'vitest'

const renderMock = vi.hoisted(() => vi.fn())
const createRootMock = vi.hoisted(() => vi.fn(() => ({ render: renderMock })))
const syncI18nLanguageMock = vi.hoisted(() => vi.fn())
const appMock = vi.hoisted(() => vi.fn(() => null))

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: createRootMock,
  },
  createRoot: createRootMock,
}))

vi.mock('./App', () => ({
  default: appMock,
}))

vi.mock('./styles/globals.css', () => ({}))
vi.mock('./styles/extensions.css', () => ({}))

vi.mock('./i18n', () => ({
  syncI18nLanguage: syncI18nLanguageMock,
}))

describe('main entrypoint', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    vi.resetModules()
    renderMock.mockReset()
    createRootMock.mockReset()
    createRootMock.mockReturnValue({ render: renderMock })
    syncI18nLanguageMock.mockReset()
    appMock.mockReset()
  })

  it('syncs i18n and mounts the app into the root element', async () => {
    await import('./main')

    expect(syncI18nLanguageMock).toHaveBeenCalledTimes(1)
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'))
    expect(renderMock).toHaveBeenCalledTimes(1)
    expect(renderMock.mock.calls[0][0]).toBeTruthy()
  })
})
