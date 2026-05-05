/**
 * Export utilities — TipTap JSON → Markdown / HTML file download
 */

import type { JSONContent } from '@tiptap/react'

// ── TipTap JSON → Markdown ─────────────────────────────────────

import { downloadBlob } from './download'

// ── TipTap JSON → Markdown ─────────────────────────────────────

function nodeToMarkdown(node: JSONContent): string {
  if (!node) return ''

  switch (node.type) {
    case 'doc': {
      return (node.content ?? []).map(nodeToMarkdown).join('\n\n')
    }
    case 'paragraph': {
      const text = (node.content ?? []).map(nodeToMarkdown).join('')
      return text || ''
    }
    case 'heading': {
      const level = node.attrs?.level ?? 1
      const prefix = '#'.repeat(level) + ' '
      const text = (node.content ?? []).map(nodeToMarkdown).join('')
      return prefix + text
    }
    case 'text': {
      let text = node.text ?? ''
      const marks = node.marks ?? []
      for (const mark of marks) {
        switch (mark.type) {
          case 'bold': text = `**${text}**`; break
          case 'italic': text = `*${text}*`; break
          case 'underline': text = `<u>${text}</u>`; break
          case 'strike': text = `~~${text}~~`; break
          case 'code': text = `\`${text}\``; break
        }
      }
      return text
    }
    case 'bulletList': {
      return (node.content ?? []).map(child => '- ' + nodeToMarkdown(child).trim()).join('\n')
    }
    case 'orderedList': {
      return (node.content ?? []).map((child, i) => `${i + 1}. ` + nodeToMarkdown(child).trim()).join('\n')
    }
    case 'listItem': {
      return (node.content ?? []).map(nodeToMarkdown).join('')
    }
    case 'blockquote': {
      const inner = (node.content ?? []).map(nodeToMarkdown).join('\n')
      return inner.split('\n').map(l => '> ' + l).join('\n')
    }
    case 'codeBlock': {
      const lang = node.attrs?.language ?? ''
      const text = (node.content ?? []).map(n => (n as JSONContent).text ?? '').join('')
      return `\`\`\`${lang}\n${text}\n\`\`\``
    }
    case 'horizontalRule': {
      return '---'
    }
    case 'hardBreak': {
      return '  \n'
    }
    case 'table': {
      const rows = (node.content ?? []).map((rowNode, rowIndex) => {
        const cells = (rowNode.content ?? []).map(cellNode => {
          return (cellNode.content ?? []).map(nodeToMarkdown).join('').replace(/\|/g, '\\|')
        })
        const row = `| ${cells.join(' | ')} |`
        if (rowIndex === 0 && (rowNode.content?.[0]?.type === 'tableHeader')) {
          const separator = `| ${cells.map(() => '---').join(' | ')} |`
          return [row, separator]
        }
        return [row]
      })
      return rows.flat().join('\n')
    }
    case 'tableRow': {
      // handled in 'table'
      return ''
    }
    case 'tableCell':
    case 'tableHeader': {
      // handled in 'table'
      return (node.content ?? []).map(nodeToMarkdown).join('')
    }
    case 'mathInline': {
      return `$${node.attrs?.latex}$`
    }
    case 'mathBlock': {
      return `$$\n${node.attrs?.latex}\n$$`
    }
    case 'callout': {
        const variant = node.attrs?.variant ?? 'info'
        const inner = (node.content ?? []).map(nodeToMarkdown).join('\n')
        return `> [!${variant.toUpperCase()}]\n` + inner.split('\n').map(l => '> ' + l).join('\n')
    }
    default: {
      if (node.content) {
        return (node.content).map(nodeToMarkdown).join('')
      }
      return ''
    }
  }
}

export function exportToMarkdown(json: JSONContent, filename?: string): void {
  const md = nodeToMarkdown(json)
  downloadFile(md, (filename || 'document') + '.md', 'text/markdown')
}

// ── TipTap JSON → HTML ─────────────────────────────────────────

function nodeToHtml(node: JSONContent): string {
  if (!node) return ''

  switch (node.type) {
    case 'doc': {
      return (node.content ?? []).map(nodeToHtml).join('\n')
    }
    case 'paragraph': {
      const inner = (node.content ?? []).map(nodeToHtml).join('')
      return `<p>${inner || '<br>'}</p>`
    }
    case 'heading': {
      const level = node.attrs?.level ?? 1
      const tag = `h${level}`
      const inner = (node.content ?? []).map(nodeToHtml).join('')
      return `<${tag}>${inner}</${tag}>`
    }
    case 'text': {
      let text = escapeHtml(node.text ?? '')
      const marks = node.marks ?? []
      for (const mark of marks) {
        switch (mark.type) {
          case 'bold': text = `<strong>${text}</strong>`; break
          case 'italic': text = `<em>${text}</em>`; break
          case 'underline': text = `<u>${text}</u>`; break
          case 'strike': text = `<del>${text}</del>`; break
          case 'code': text = `<code>${text}</code>`; break
        }
      }
      return text
    }
    case 'bulletList': {
      const inner = (node.content ?? []).map(nodeToHtml).join('\n')
      return `<ul>\n${inner}\n</ul>`
    }
    case 'orderedList': {
      const inner = (node.content ?? []).map(nodeToHtml).join('\n')
      return `<ol>\n${inner}\n</ol>`
    }
    case 'listItem': {
      const inner = (node.content ?? []).map(nodeToHtml).join('')
      return `<li>${inner}</li>`
    }
    case 'blockquote': {
      const inner = (node.content ?? []).map(nodeToHtml).join('\n')
      return `<blockquote>\n${inner}\n</blockquote>`
    }
    case 'codeBlock': {
      const text = (node.content ?? []).map(n => (n as JSONContent).text ?? '').join('')
      return `<pre><code>${escapeHtml(text)}</code></pre>`
    }
    case 'horizontalRule': {
      return '<hr />'
    }
    case 'hardBreak': {
      return '<br />'
    }
    case 'table': {
        return `<table>${(node.content ?? []).map(nodeToHtml).join('')}</table>`
    }
    case 'tableRow': {
        return `<tr>${(node.content ?? []).map(nodeToHtml).join('')}</tr>`
    }
    case 'tableCell': {
        return `<td>${(node.content ?? []).map(nodeToHtml).join('')}</td>`
    }
    case 'tableHeader': {
        return `<th>${(node.content ?? []).map(nodeToHtml).join('')}</th>`
    }
    case 'mathInline': {
        return `<span class="math-inline" data-latex="${escapeHtml(node.attrs?.latex ?? '')}">$${escapeHtml(node.attrs?.latex ?? '')}$</span>`
    }
    case 'mathBlock': {
        return `<div class="math-block" data-latex="${escapeHtml(node.attrs?.latex ?? '')}">$$${escapeHtml(node.attrs?.latex ?? '')}$$</div>`
    }
    case 'callout': {
        const variant = node.attrs?.variant ?? 'info'
        const inner = (node.content ?? []).map(nodeToHtml).join('\n')
        return `<div class="callout" data-variant="${variant}">${inner}</div>`
    }
    default: {
      if (node.content) {
        return (node.content).map(nodeToHtml).join('')
      }
      return ''
    }
  }
}

export function exportToHtml(json: JSONContent, filename?: string): void {
  const body = nodeToHtml(json)
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Document</title>
  <style>
    body { font-family: Georgia, serif; max-width: 680px; margin: 2rem auto; padding: 0 1rem; line-height: 1.8; color: #333; }
    h1, h2, h3 { margin-top: 1.5em; }
    blockquote { border-left: 3px solid #ccc; padding-left: 1em; color: #666; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    pre code { display: block; padding: 1em; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ccc; padding: 0.5em; }
    .callout { margin: 1em 0; padding: 1em; border-radius: 8px; border-left-width: 4px; }
    .callout[data-variant='info'] { background-color: #eef2ff; border-color: #60a5fa; color: #1e3a8a; }
    .callout[data-variant='warning'] { background-color: #fefce8; border-color: #facc15; color: #713f12; }
    .callout[data-variant='tip'] { background-color: #f0fdf4; border-color: #4ade80; color: #14532d; }
    .callout[data-variant='important'] { background-color: #fef2f2; border-color: #f87171; color: #7f1d1d; }
  </style>
</head>
<body>
${body}
</body>
</html>`
  downloadFile(html, (filename || 'document') + '.html', 'text/html')
}

// ── PDF Export (browser print) ────────────────────────────────

export function exportToPdf(): void {
  window.print()
}

// ── Helpers ─────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function downloadFile(content: string | Blob, filename: string, mimeType?: string): void {
    if (typeof content === 'string') {
        const blob = new Blob([content], { type: (mimeType || 'text/plain') + ';charset=utf-8' })
        downloadBlob(blob, filename)
    } else {
        downloadBlob(content, filename)
    }
}
