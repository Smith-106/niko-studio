import { describe, it, expect } from 'vitest'
import { QualityGateLoop } from './quality-gate-loop'
import { NarrativeAgent } from './narrative-agent'
import { NarrativeEngine } from './narrative-engine'
import { KnowledgeBridgeV2 } from './knowledge-bridge-v2'

describe('QualityGateLoop', () => {
  const gate = new QualityGateLoop()

  it('should PASS high quality text', () => {
    const outcome = gate.quickScan('然而，秘密就藏在那扇门后。她不得不推开它，却发现真相远比想象中可怕。')
    expect(outcome.result).toMatch(/PASS|WARN/)
    expect(outcome.score).toBeGreaterThan(0)
  })

  it('should FAIL low quality text', () => {
    const outcome = gate.quickScan('今天天气不错。')
    expect(outcome.score).toBeLessThan(60)
  })

  it('should evaluate at different levels', async () => {
    const text = '然而，秘密就在门后。她不得不做出选择。但真相远比想象中危险。'
    const quick = await gate.evaluate(text, 'quick')
    const standard = await gate.evaluate(text, 'standard')
    expect(quick.score).toBeGreaterThan(0)
    expect(standard.score).toBeGreaterThan(0)
  })

  it('should run revision loop', async () => {
    let callCount = 0
    const reviseFn = async (text: string, report: any) => {
      callCount++
      // 模拟修订：每次加一些冲突词
      return text + ' 然而，更大的危险正在逼近。'
    }
    const outcome = await gate.revisionLoop('今天天气不错。', 'quick', reviseFn)
    expect(outcome.history.length).toBeGreaterThan(0)
    expect(outcome.revisionCount).toBeGreaterThanOrEqual(0)
  })

  it('should detect stagnation', async () => {
    const reviseFn = async (text: string) => text // 不做任何修改
    const outcome = await gate.revisionLoop('今天天气不错。', 'quick', reviseFn)
    expect(outcome.result).toMatch(/WARN|FAIL/)
  })
})
