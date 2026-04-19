import { describe, expect, it } from 'vitest'

import { buildFailurePresentation } from './failurePresentation'

const t = {
  failureCategoryGeneration: '生成失败',
  failureCategoryEvaluation: '评估失败',
  failureCategoryRetrieval: '资料拉取失败',
  failureCategoryConnection: '连接失败',
  failureMessageGeneration: '本次内容生成没有完成。',
  failureMessageEvaluation: '当前评估步骤暂时不可用。',
  failureMessageRetrieval: '这次没有成功取到参考资料。',
  failureMessageConnection: '当前与本地服务的连接不稳定。',
}

describe('buildFailurePresentation', () => {
  it('classifies retrieval-oriented failures from the detail text', () => {
    expect(buildFailurePresentation({
      t,
      error: 'knowledge retrieval request failed',
    })).toMatchObject({
      category: 'retrieval',
      label: t.failureCategoryRetrieval,
      message: t.failureMessageRetrieval,
    })
  })

  it('classifies evaluation failures from the source when the text is generic', () => {
    expect(buildFailurePresentation({
      t,
      source: 'evaluation',
      error: 'Request failed',
    })).toMatchObject({
      category: 'evaluation',
      label: t.failureCategoryEvaluation,
      message: t.failureMessageEvaluation,
    })
  })

  it('prioritizes connection failures when the request cannot reach the service', () => {
    expect(buildFailurePresentation({
      t,
      source: 'evaluation',
      error: 'Failed to fetch',
    })).toMatchObject({
      category: 'connection',
      label: t.failureCategoryConnection,
      message: t.failureMessageConnection,
    })
  })
})
