// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

interface LocalShellResolution {
  base: string | null
  source: string
}

interface LocalShellModule {
  buildLocalShellEnv: (base: string | null, parentEnv?: NodeJS.ProcessEnv) => NodeJS.ProcessEnv
  readTrackedGatewayBase: (statePath?: string) => string | null
  resolveLocalShellGatewayBase: (options?: {
    env?: NodeJS.ProcessEnv
    statePath?: string
    testHealth?: (base: string) => Promise<boolean>
  }) => Promise<LocalShellResolution>
}

const scriptUrl = pathToFileURL(path.resolve(__dirname, './run_local_vite_shell.cjs')).href
const modulePromise = import(scriptUrl).then((namespace) => (namespace.default ?? namespace) as LocalShellModule)

const tempDirectories: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    tempDirectories.splice(0).map(async (directory) => {
      await rm(directory, { recursive: true, force: true })
    }),
  )
})

async function createStateFile(base: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'niko-local-shell-'))
  tempDirectories.push(directory)
  const statePath = path.join(directory, 'desktop-local-state.json')
  await writeFile(
    statePath,
    `\uFEFF${JSON.stringify({ gateway: { base } }, null, 2)}`,
    'utf8',
  )
  return statePath
}

describe('run_local_vite_shell', () => {
  it('prefers an explicit VITE gateway override without consulting local launcher state', async () => {
    const script = await modulePromise
    const testHealth = vi.fn<(base: string) => Promise<boolean>>()

    await expect(
      script.resolveLocalShellGatewayBase({
        env: { VITE_NIKO_GATEWAY_URL: 'http://127.0.0.1:8010/' },
        testHealth,
      }),
    ).resolves.toEqual({
      base: 'http://127.0.0.1:8010',
      source: 'env:VITE_NIKO_GATEWAY_URL',
    })
    expect(testHealth).not.toHaveBeenCalled()
  })

  it('promotes NIKO_GATEWAY_URL into the browser-visible VITE channel', async () => {
    const script = await modulePromise

    const resolved = await script.resolveLocalShellGatewayBase({
      env: { NIKO_GATEWAY_URL: 'http://127.0.0.1:8010/' },
    })
    const childEnv = script.buildLocalShellEnv(resolved.base, { PATH: 'test-path' })

    expect(resolved).toEqual({
      base: 'http://127.0.0.1:8010',
      source: 'env:NIKO_GATEWAY_URL',
    })
    expect(childEnv.VITE_NIKO_GATEWAY_URL).toBe('http://127.0.0.1:8010')
    expect(childEnv.PATH).toBe('test-path')
  })

  it('uses the tracked launcher gateway when the recorded base is healthy', async () => {
    const script = await modulePromise
    const statePath = await createStateFile('http://127.0.0.1:8010/')
    const testHealth = vi.fn(async (base: string) => base === 'http://127.0.0.1:8010')

    expect(script.readTrackedGatewayBase(statePath)).toBe('http://127.0.0.1:8010')
    await expect(
      script.resolveLocalShellGatewayBase({
        env: {},
        statePath,
        testHealth,
      }),
    ).resolves.toEqual({
      base: 'http://127.0.0.1:8010',
      source: 'desktop-local-state.json',
    })
    expect(testHealth).toHaveBeenCalledWith('http://127.0.0.1:8010')
  })

  it('falls back to frontend defaults when the tracked gateway is stale', async () => {
    const script = await modulePromise
    const statePath = await createStateFile('http://127.0.0.1:8010/')
    const testHealth = vi.fn(async () => false)

    await expect(
      script.resolveLocalShellGatewayBase({
        env: {},
        statePath,
        testHealth,
      }),
    ).resolves.toEqual({
      base: null,
      source: 'default',
    })
  })
})
