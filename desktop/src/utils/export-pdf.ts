import type { WritingCraftResult, DimensionResult } from '../api/writing-craft';

export function generatePdfHtml(result: WritingCraftResult): string {
  const dimSections = result.dimensions.map((dim) => {
    const barWidth = (dim.score / dim.maxScore) * 100;
    const barColor = dim.score >= 7 ? '#059669' : dim.score >= 4 ? '#d97706' : '#dc2626';

    const evidenceHtml = dim.evidence.length > 0
      ? `<div style="margin-top:8px"><strong>检测证据</strong><ul>${dim.evidence.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul></div>`
      : '';

    const suggestionsHtml = dim.suggestions.length > 0
      ? `<div style="margin-top:8px"><strong>改进建议</strong><ul>${dim.suggestions.slice(0, 5).map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>`
      : '';

    return `
      <div style="margin-bottom:20px;page-break-inside:avoid">
        <h3 style="margin:0 0 4px;color:#1e293b">${escapeHtml(dim.label)} (${dim.score}/${dim.maxScore})</h3>
        <div style="background:#e2e8f0;border-radius:4px;height:8px;width:100%">
          <div style="background:${barColor};border-radius:4px;height:8px;width:${barWidth}%"></div>
        </div>
        ${evidenceHtml}
        ${suggestionsHtml}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>写作质量分析报告</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #334155; line-height: 1.6; }
    h1 { color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
    h2 { color: #1e293b; margin-top: 24px; }
    .score { font-size: 48px; font-weight: bold; color: #3b82f6; }
    .meta { color: #64748b; font-size: 14px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 4px; font-size: 14px; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <h1>写作质量分析报告</h1>
  <div style="display:flex;align-items:baseline;gap:8px;margin:16px 0">
    <span class="score">${result.overallScore}</span>
    <span style="color:#64748b;font-size:18px">/ 10</span>
  </div>
  <div class="meta">文本长度：${result.textLength} 字 | 生成时间：${new Date().toLocaleString('zh-CN')}</div>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
  <h2>维度详情</h2>
  ${dimSections}
  <div class="footer">由 Niko Studio 写作分析引擎生成</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadPdfFile(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
