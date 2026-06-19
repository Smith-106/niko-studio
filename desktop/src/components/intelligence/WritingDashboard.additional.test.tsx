import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const analyzeWritingCraftMock = vi.hoisted(() => vi.fn());
const analyzeEmotionalArcMock = vi.hoisted(() => vi.fn());
const generateMarkdownReportMock = vi.hoisted(() => vi.fn());
const downloadAsFileMock = vi.hoisted(() => vi.fn());
const generatePdfHtmlMock = vi.hoisted(() => vi.fn());
const downloadPdfFileMock = vi.hoisted(() => vi.fn());

vi.mock('../../api/writing-craft', async () => {
  const actual = await vi.importActual<typeof import('../../api/writing-craft')>('../../api/writing-craft');
  return {
    ...actual,
    analyzeWritingCraft: analyzeWritingCraftMock,
    analyzeEmotionalArc: analyzeEmotionalArcMock,
  };
});

vi.mock('../../utils/export-analysis', () => ({
  generateMarkdownReport: generateMarkdownReportMock,
  downloadAsFile: downloadAsFileMock,
}));

vi.mock('../../utils/export-pdf', () => ({
  generatePdfHtml: generatePdfHtmlMock,
  downloadPdfFile: downloadPdfFileMock,
}));

vi.mock('./SectionHeader', () => ({
  SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
}));

vi.mock('./ProgressBar', () => ({
  ProgressBar: ({ value }: { value: number }) => <div>{`progress:${value}`}</div>,
}));

vi.mock('./WritingDimensionDetail', () => ({
  WritingDimensionDetail: ({
    dimension,
    llmConfig,
  }: {
    dimension: { dimension: string };
    llmConfig?: unknown;
  }) => <div>{`detail:${dimension.dimension}:${llmConfig ? 'llm' : 'plain'}`}</div>,
}));

vi.mock('./InlineAnnotation', () => ({
  InlineAnnotation: ({
    text,
    dimensions,
  }: {
    text: string;
    dimensions: Array<unknown>;
  }) => <div>{`annotation:${dimensions.length}:${text}`}</div>,
}));

vi.mock('./EmotionalArcChart', () => ({
  EmotionalArcChart: ({ result }: { result: { timeline: Array<unknown> } }) => (
    <div>{`arc:${result.timeline.length}`}</div>
  ),
}));

vi.mock('./ReaderImmersionDashboard', () => ({
  ReaderImmersionDashboard: ({
    chapters,
    visible,
  }: {
    chapters: Array<unknown>;
    visible: boolean;
  }) => <div>{`immersion:${visible}:${chapters.length}`}</div>,
}));

vi.mock('./PacingPrescriptionPanel', () => ({
  PacingPrescriptionPanel: ({
    chapters,
    visible,
  }: {
    chapters: Array<unknown>;
    visible: boolean;
  }) => <div>{`pacing:${visible}:${chapters.length}`}</div>,
}));

import type { EmotionalArcResult, LLMConfig, WritingCraftResult } from '../../api/writing-craft';
import { WritingDashboard } from './WritingDashboard';

const mockAnalyzeWritingCraft = vi.mocked(analyzeWritingCraftMock);
const mockAnalyzeEmotionalArc = vi.mocked(analyzeEmotionalArcMock);
const mockGenerateMarkdownReport = vi.mocked(generateMarkdownReportMock);
const mockDownloadAsFile = vi.mocked(downloadAsFileMock);
const mockGeneratePdfHtml = vi.mocked(generatePdfHtmlMock);
const mockDownloadPdfFile = vi.mocked(downloadPdfFileMock);

const LLM_CONFIG: LLMConfig = {
  api_key: 'test-key',
  base_url: 'https://example.test',
  model: 'gpt-test',
};

const CHAPTERS = [
  { chapterIndex: 0, content: '第一章内容' },
  { chapterIndex: 1, content: '第二章内容' },
];

const SINGLE_RESULT: WritingCraftResult = {
  overallScore: 6.5,
  textLength: 200,
  dimensions: [
    {
      dimension: 'structure',
      label: '结构分析',
      score: 7,
      maxScore: 10,
      evidence: ['三幕结构完整'],
      suggestions: ['加强中段张力'],
      details: {},
    },
    {
      dimension: 'character',
      label: '角色分析',
      score: 6,
      maxScore: 10,
      evidence: ['角色动机明确'],
      suggestions: ['增加内心冲突'],
      details: {},
    },
  ],
};

const ARC_RESULT: EmotionalArcResult = {
  timeline: [
    {
      chapterIndex: 0,
      emotionScore: 0.4,
      showTellRatio: 0.3,
      layerRichness: 0.6,
      dominantEmotion: 'hope',
      emotionalIntensity: 0.7,
    },
    {
      chapterIndex: 1,
      emotionScore: 0.8,
      showTellRatio: 0.5,
      layerRichness: 0.7,
      dominantEmotion: 'fear',
      emotionalIntensity: 0.9,
    },
  ],
  tensionDeserts: [],
  curveMatches: [],
  overallArcScore: 0.8,
  suggestions: ['补足跨章情绪连接'],
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('WritingDashboard additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateMarkdownReport.mockReturnValue('# report');
    mockGeneratePdfHtml.mockReturnValue('<html>report</html>');
  });

  it('shows loading, toggles annotation mode, exports reports, and handles missing dimension details', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<{ success: boolean; data?: WritingCraftResult; error?: string }>();
    mockAnalyzeWritingCraft.mockReturnValueOnce(deferred.promise);

    render(
      <WritingDashboard
        text="示例文本"
        visible={true}
        llmConfig={LLM_CONFIG}
        chapters={CHAPTERS}
      />,
    );

    await user.click(screen.getByRole('button', { name: '开始分析' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '分析中...' })).toBeDisabled();
    });
    expect(screen.getByText('正在分析文本...')).toBeInTheDocument();

    deferred.resolve({
      success: true,
      data: SINGLE_RESULT,
    });

    await waitFor(() => {
      expect(screen.getByText('综合评分 · 6.5/10')).toBeInTheDocument();
    });

    expect(screen.getByText('progress:65')).toBeInTheDocument();
    expect(screen.getByText('detail:structure:llm')).toBeInTheDocument();

    await user.click(screen.getByText('角色'));
    expect(screen.getByText('detail:character:llm')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '标注模式' }));
    expect(screen.getByText('annotation:2:示例文本')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '面板模式' }));
    expect(screen.getByText('detail:character:llm')).toBeInTheDocument();

    await user.click(screen.getByText('钩子'));
    expect(screen.getByText('未找到该维度的分析结果')).toBeInTheDocument();

    await user.click(screen.getByTitle('导出 Markdown 报告'));
    expect(mockGenerateMarkdownReport).toHaveBeenCalledWith(SINGLE_RESULT);
    expect(mockDownloadAsFile).toHaveBeenCalledWith(
      '# report',
      expect.stringMatching(/^writing-analysis-\d{4}-\d{2}-\d{2}\.md$/),
    );

    await user.click(screen.getByTitle('导出 PDF 报告'));
    expect(mockGeneratePdfHtml).toHaveBeenCalledWith(SINGLE_RESULT);
    expect(mockDownloadPdfFile).toHaveBeenCalledWith('<html>report</html>', 'writing-analysis-report.html');
  });

  it('falls back to default single-analysis failure text when the backend error is empty', async () => {
    const user = userEvent.setup();
    mockAnalyzeWritingCraft.mockResolvedValueOnce({
      success: false,
      error: undefined,
    });

    render(<WritingDashboard text="示例文本" visible={true} />);
    await user.click(screen.getByRole('button', { name: '开始分析' }));

    await waitFor(() => {
      expect(screen.getByText('Analysis failed')).toBeInTheDocument();
    });
  });

  it('shows Unknown error when single analysis throws a non-Error value', async () => {
    const user = userEvent.setup();
    mockAnalyzeWritingCraft.mockRejectedValueOnce('boom');

    render(<WritingDashboard text="示例文本" visible={true} />);
    await user.click(screen.getByRole('button', { name: '开始分析' }));

    await waitFor(() => {
      expect(screen.getByText('Unknown error')).toBeInTheDocument();
    });
  });

  it('auto-runs cross-chapter analysis, renders child dashboards, and avoids duplicate auto-fetch when data is cached', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<{ success: boolean; data?: EmotionalArcResult; error?: string }>();
    mockAnalyzeEmotionalArc
      .mockReturnValueOnce(deferred.promise)
      .mockResolvedValueOnce({
        success: true,
        data: ARC_RESULT,
      });

    render(<WritingDashboard text="示例文本" visible={true} chapters={CHAPTERS} />);

    await user.click(screen.getByRole('button', { name: '跨章节' }));

    await waitFor(() => {
      expect(mockAnalyzeEmotionalArc).toHaveBeenCalledTimes(1);
    });
    expect(mockAnalyzeEmotionalArc).toHaveBeenCalledWith(CHAPTERS);
    expect(screen.getByRole('button', { name: '分析中...' })).toBeDisabled();
    expect(screen.getByText('正在分析跨章节数据...')).toBeInTheDocument();

    deferred.resolve({
      success: true,
      data: ARC_RESULT,
    });

    await waitFor(() => {
      expect(screen.getByText('arc:2')).toBeInTheDocument();
    });
    expect(screen.getByText('immersion:true:2')).toBeInTheDocument();
    expect(screen.getByText('pacing:true:2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '单章' }));
    await user.click(screen.getByRole('button', { name: '跨章节' }));
    expect(mockAnalyzeEmotionalArc).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '重新分析' }));

    await waitFor(() => {
      expect(mockAnalyzeEmotionalArc).toHaveBeenCalledTimes(2);
    });
  });

  it('shows cross-chapter fallback and thrown errors', async () => {
    const user = userEvent.setup();
    mockAnalyzeEmotionalArc
      .mockResolvedValueOnce({
        success: false,
        error: undefined,
      })
      .mockRejectedValueOnce('boom');

    const { rerender } = render(<WritingDashboard text="示例文本" visible={true} chapters={CHAPTERS} />);

    await user.click(screen.getByRole('button', { name: '跨章节' }));
    await waitFor(() => {
      expect(screen.getByText('Analysis failed')).toBeInTheDocument();
    });

    rerender(<WritingDashboard text="示例文本" visible={true} chapters={[...CHAPTERS, { chapterIndex: 2, content: '第三章内容' }]} />);
    await user.click(screen.getByRole('button', { name: '跨章节' }));

    await waitFor(() => {
      expect(screen.getByText('Unknown error')).toBeInTheDocument();
    });
  });
});
