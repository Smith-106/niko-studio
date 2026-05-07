import type { WritingCraftResult, DimensionResult } from '../api/writing-craft';

export function generateMarkdownReport(result: WritingCraftResult): string {
  const lines: string[] = [];

  lines.push('# 写作质量分析报告');
  lines.push('');
  lines.push(`**综合评分**: ${result.overallScore}/10`);
  lines.push(`**文本长度**: ${result.textLength} 字`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const dim of result.dimensions) {
    lines.push(`## ${dim.label} (${dim.score}/${dim.maxScore})`);
    lines.push('');

    if (dim.evidence.length > 0) {
      lines.push('### 检测证据');
      lines.push('');
      for (const ev of dim.evidence) {
        lines.push(`- ${ev}`);
      }
      lines.push('');
    }

    if (dim.suggestions.length > 0) {
      lines.push('### 改进建议');
      lines.push('');
      for (const s of dim.suggestions) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadAsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
