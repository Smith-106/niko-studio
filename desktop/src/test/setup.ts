import '@testing-library/jest-dom'
import { vi } from 'vitest'

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  value: () => {},
  writable: true,
})

const originalWarn = console.warn.bind(console)
vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  const message = args.map((arg) => String(arg)).join(' ')
  if (message.includes('createWithEqualityFn') && message.includes('zustand')) {
    return
  }
  originalWarn(...(args as Parameters<typeof console.warn>))
})
