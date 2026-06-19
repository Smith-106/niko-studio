import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ConstraintSeverity,
  CreativitySpectrumConfig,
  HardConstraintViolation,
  QCEnforcementResult,
  QualityDimension,
} from './QCDashboard'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/core', () => ({
  callApi: callApiMock,
}))

import { QCDashboard } from './QCDashboard'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createCreativityConfig(
  overrides: Partial<CreativitySpectrumConfig> = {},
): CreativitySpectrumConfig {
  return {
    value: 0.63,
    preset: 'experimental',
    modeDefault: 0.5,
    constraints: {
      maxSentenceLength: 32,
      minVocabularyDiversity: 0.3,
      maxMetaphorDensity: 0.45,
      allowNonlinearStructure: true,
      allowUnreliableNarrator: false,
    },
    ...overrides,
  }
}

function createViolation(
  dimension: QualityDimension,
  severity: ConstraintSeverity,
  message: string,
  overrides: Partial<HardConstraintViolation> = {},
): HardConstraintViolation {
  return {
    dimension,
    severity,
    message,
    location: {},
    evidence: '',
    suggestedFix: null,
    ...overrides,
  }
}

function createResponse(result: QCEnforcementResult) {
  return {
    success: true,
    data: { result },
  }
}

describe('QCDashboard', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('renders the empty state, enters loading, and shows the fallback API failure message', async () => {
    const deferred = createDeferred<{
      success: boolean
      error?: string
      data?: { result: QCEnforcementResult }
    }>()

    callApiMock.mockReturnValue(deferred.promise)

    render(<QCDashboard novelId="novel-empty" />)

    expect(screen.getByText('点击「运行质量检查」查看质量控制报告')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '运行质量检查' }))

    expect(callApiMock).toHaveBeenCalledWith('/qc/validate', 'POST', {
      text: 'novel-empty',
      mode: 'auto',
    })
    expect(screen.getByText('正在执行质量检查...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '检查中...' })).toBeDisabled()

    deferred.resolve({ success: false })

    await waitFor(() => {
      expect(screen.getByText('Quality check failed')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: '运行质量检查' })).toBeEnabled()
    expect(screen.queryByText('正在执行质量检查...')).not.toBeInTheDocument()
  })

  it('recovers from thrown errors and renders a clean advisory report when no violations are found', async () => {
    callApiMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(
        createResponse({
          mode: 'advisory',
          allowed: true,
          warnings: [],
          blocked: [],
          creativityConfig: createCreativityConfig({
            value: 0.82,
            preset: 'balanced',
          }),
        }),
      )

    render(<QCDashboard novelId="novel-clean" />)

    fireEvent.click(screen.getByRole('button', { name: '运行质量检查' }))

    await waitFor(() => {
      expect(screen.getByText('network down')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '运行质量检查' }))

    await waitFor(() => {
      expect(screen.getByText('未检测到违规项')).toBeInTheDocument()
    })

    expect(screen.getByText('输出允许')).toBeInTheDocument()
    expect(screen.getByText('(建议模式)')).toBeInTheDocument()
    expect(screen.getByText('质量良好，可继续优化细节')).toBeInTheDocument()
    expect(screen.getByText('创意光谱')).toBeInTheDocument()
    expect(screen.getByText('预设:')).toBeInTheDocument()
    expect(screen.getByText('均衡')).toBeInTheDocument()
    expect(screen.getByText(/值:/)).toBeInTheDocument()
    expect(screen.getByText('最近检查:', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/非线性结构: 允许/)).toBeInTheDocument()
    expect(screen.getByText(/不可靠叙述: 禁止/)).toBeInTheDocument()
    expect(screen.queryByText('违规列表')).not.toBeInTheDocument()
    expect(callApiMock).toHaveBeenCalledTimes(2)
  })

  it('renders blocking results, grouped dimensions, and expandable violation details', async () => {
    const blocked = [
      createViolation('plot-coherence', 'critical', '主线冲突失去因果闭环', {
        location: {
          chapterId: '12',
          paragraphIndex: 2,
          characterId: 'hero-1',
        },
        evidence: '主角在上一章已经知道真相，这里又表现得毫不知情。',
        suggestedFix: '补写主角的伪装动机，或调整前文信息揭示顺序。',
      }),
      createViolation('plot-coherence', 'high', '关键转折缺少铺垫'),
      createViolation('character-consistency', 'critical', '主角动机与既定设定矛盾'),
      createViolation('character-consistency', 'critical', '主角价值观在结尾突变'),
      createViolation('character-consistency', 'high', '配角立场突然倒向反派'),
    ]
    const warnings = [
      createViolation('style-consistency', 'critical', '叙述视角在段落间频繁漂移'),
      createViolation('style-consistency', 'high', '文风从克制突变为夸饰'),
      createViolation('style-consistency', 'medium', '比喻密度突然升高'),
      createViolation('style-consistency', 'medium', '口语化表达打破既定语体'),
      createViolation('pacing-tension', 'high', '高潮推进被回忆插叙打断'),
      createViolation('pacing-tension', 'high', '高潮前插入解释段落削弱张力'),
      createViolation('pacing-tension', 'medium', '场景切换缺少承接句'),
      createViolation('pacing-tension', 'low', '段尾收束稍弱'),
    ]

    callApiMock.mockResolvedValue(
      createResponse({
        mode: 'blocking',
        allowed: false,
        blocked,
        warnings,
        creativityConfig: createCreativityConfig(),
      }),
    )

    render(<QCDashboard novelId="novel-blocked" />)

    fireEvent.click(screen.getByRole('button', { name: '运行质量检查' }))

    await waitFor(() => {
      expect(screen.getByText('输出被阻止')).toBeInTheDocument()
    })

    expect(screen.getByText('(阻断模式)')).toBeInTheDocument()
    expect(screen.getByText('5 项阻断性违规需要修复')).toBeInTheDocument()
    expect(screen.getByText('质量较低，建议优先修复严重问题')).toBeInTheDocument()
    expect(screen.getByText('违规列表')).toBeInTheDocument()
    expect(screen.getByText('共 13 项')).toBeInTheDocument()

    expect(screen.getByText('情节连贯')).toBeInTheDocument()
    expect(screen.getByText('角色一致')).toBeInTheDocument()
    expect(screen.getByText('风格一致')).toBeInTheDocument()
    expect(screen.getByText('节奏张力')).toBeInTheDocument()
    expect(screen.getByText('违规 2 项')).toBeInTheDocument()
    expect(screen.getAllByText('违规 3 项').length).toBeGreaterThan(0)
    expect(screen.getAllByText('违规 4 项')).toHaveLength(2)
    expect(screen.getAllByText('✗ 未通过').length).toBeGreaterThan(0)

    const primaryRowButton = screen
      .getByText('主线冲突失去因果闭环')
      .closest('button')
    expect(primaryRowButton).toBeTruthy()
    fireEvent.click(primaryRowButton!)

    await waitFor(() => {
      expect(
        screen.getByText('章节 12 / 段落 2 / 角色 hero-1'),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByText('主角在上一章已经知道真相，这里又表现得毫不知情。'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('补写主角的伪装动机，或调整前文信息揭示顺序。'),
    ).toBeInTheDocument()

    const secondaryRowButton = screen
      .getByText('主角动机与既定设定矛盾')
      .closest('button')
    expect(secondaryRowButton).toBeTruthy()
    fireEvent.click(secondaryRowButton!)

    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  it('shows the mid-range quality summary when violations leave room for improvement', async () => {
    callApiMock.mockResolvedValue(
      createResponse({
        mode: 'advisory',
        allowed: true,
        blocked: [
          createViolation('plot-coherence', 'critical', '转折缺少前置铺垫'),
          createViolation('plot-coherence', 'high', '主支线连接松散'),
        ],
        warnings: [
          createViolation('character-consistency', 'critical', '人物口吻轻微漂移'),
          createViolation('character-consistency', 'high', '动机表达不够稳定'),
          createViolation('style-consistency', 'high', '修辞密度略高'),
          createViolation('style-consistency', 'medium', '句式节奏单一'),
          createViolation('pacing-tension', 'medium', '场景切换略显突兀'),
          createViolation('pacing-tension', 'low', '小节结尾力度不足'),
        ],
        creativityConfig: createCreativityConfig({
          preset: 'creative',
        }),
      }),
    )

    render(<QCDashboard novelId="novel-mid" />)

    fireEvent.click(screen.getByRole('button', { name: '运行质量检查' }))

    await waitFor(() => {
      expect(screen.getByText('存在改进空间，建议关注违规项')).toBeInTheDocument()
    })

    expect(screen.getByText('输出允许')).toBeInTheDocument()
    expect(screen.getByText('创意')).toBeInTheDocument()
  })
})
