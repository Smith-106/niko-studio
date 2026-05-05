/**
 * Export utilities — TipTap JSON → Markdown / HTML file download
 */

import type { JSONContent } from '@tiptap/react'

// ── TipTap JSON → Markdown ─────────────────────────────────────

function nodeToMarkdown(node: JSONContent): string {
  if (!node) return ''

  switch (node.type) {
    case 'doc': {
      return (node.content ?? []).map(nodeToMarkdown).join('\n')
    }
    case 'paragraph': {
      const text = (node.content ?? []).map(nodeToMarkdown).join('')
      return text
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
      return `<p>${inner}</p>`
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

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}
