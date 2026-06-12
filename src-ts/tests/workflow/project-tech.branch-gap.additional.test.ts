import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  PROJECT_TECH_RELATIVE_PATH,
  checkProjectTechFreshness,
} from '../../workflow/project-tech.js'

const tempDirs: string[] = []

function createWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-project-tech-branch-'))
  tempDirs.push(dir)
  return dir
}

function writeProjectTech(workspace: string, payload: unknown): string {
  const filePath = path.join(workspace, PROJECT_TECH_RELATIVE_PATH)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
  return filePath
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe('workflow/project-tech branch coverage', () => {
  it('falls back to empty metadata when _metadata is null', () => {
    const workspace = createWorkspace()
    writeProjectTech(workspace, {
      overview: {},
      statistics: {},
      freshness: {
        generated_at: '2026-01-07T00:00:00.000Z',
        source: 'ci',
        schema_version: '1.0.0',
        ttl_hours: 24,
      },
      _metadata: null,
    })

    const result = checkProjectTechFreshness(workspace, {
      strict: false,
      now: new Date('2026-01-07T12:00:00.000Z'),
    })

    expect(result.status).toBe('fresh')
    expect(result.ok).toBe(true)
    expect(result.source).toBe('ci')
    expect(result.schema_version).toBe('1.0.0')
    expect(result.age_hours).toBe(12)
  })

  it('stringifies non-Error payload loader failures as invalid freshness messages', async () => {
    const workspace = createWorkspace()
    writeProjectTech(workspace, {
      overview: {},
      statistics: {},
      freshness: {
        generated_at: '2026-01-07T00:00:00.000Z',
        source: 'ci',
        schema_version: '1.0.0',
        ttl_hours: 24,
      },
      _metadata: {},
    })

    const actualFs = await import('node:fs')
    let existsSyncCalls = 0

    vi.resetModules()
    vi.doMock('node:fs', () => ({
      ...actualFs,
      existsSync: ((target: fs.PathLike) => {
        existsSyncCalls += 1
        if (existsSyncCalls === 2) {
          throw 'non-error-payload-loader-failure'
        }
        return actualFs.existsSync(target)
      }) as typeof actualFs.existsSync,
    }))

    const module = await import('../../workflow/project-tech.js?non-error-loader-failure')

    const result = module.checkProjectTechFreshness(workspace, {
      strict: false,
      now: new Date('2026-01-07T12:00:00.000Z'),
    })

    expect(result.status).toBe('invalid')
    expect(result.ok).toBe(true)
    expect(result.blocking).toBe(false)
    expect(result.message).toBe('non-error-payload-loader-failure')

    vi.doUnmock('node:fs')
    vi.resetModules()
  })
})
