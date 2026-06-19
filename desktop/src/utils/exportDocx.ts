/**
 * TipTap JSON to DOCX Exporter
 */

import type { JSONContent } from '@tiptap/react'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  VerticalAlign,
  ShadingType,
  UnderlineType,
  LevelFormat,
} from 'docx'
import { useAppStore } from '../stores/appStore'
import { readChapterContent } from '../services/projectFileService'

function mapHeadingLevel(level: number) {
  switch (level) {
    case 1: return HeadingLevel.HEADING_1
    case 2: return HeadingLevel.HEADING_2
    case 3: return HeadingLevel.HEADING_3
    default: return undefined
  }
}

type NodeHandler = (node: JSONContent) => (Paragraph | Table)[]

const nodeHandlers: Record<string, NodeHandler> = {
  doc: (node) => (node.content ?? []).flatMap(nodeToDocx),
  paragraph: (node) => [
    new Paragraph({
      children: (node.content ?? []).map(textNodeToDocx),
    }),
  ],
  heading: (node) => [
    new Paragraph({
      heading: mapHeadingLevel(node.attrs?.level ?? 1),
      children: (node.content ?? []).map(textNodeToDocx),
    }),
  ],
  bulletList: (node) =>
    (node.content ?? []).flatMap((item) =>
      (item.content ?? []).map(
        (p) =>
          new Paragraph({
            bullet: { level: 0 },
            children: (p.content ?? []).map(textNodeToDocx),
          }),
      ),
    ),
  orderedList: (node) =>
    (node.content ?? []).flatMap((item) =>
      (item.content ?? []).map(
        (p) =>
          new Paragraph({
            numbering: { reference: 'default-numbering', level: 0 },
            children: (p.content ?? []).map(textNodeToDocx),
          }),
      ),
    ),
  blockquote: (node) =>
    (node.content ?? []).map(
      (p) =>
        new Paragraph({
          children: (p.content ?? []).map(textNodeToDocx),
          style: 'IntenseQuote',
        }),
    ),
  codeBlock: (node) => [
    new Paragraph({
      children: [new TextRun({ text: (node.content ?? []).map((n) => n.text ?? '').join('\n') })],
      style: 'SourceCode',
    }),
  ],
  horizontalRule: () => [new Paragraph({ border: { bottom: { color: 'auto', space: 1, style: 'single', size: 6 } } })],
  table: (node) => {
    const rows = (node.content ?? []).map((rowNode) => {
      const cells = (rowNode.content ?? []).map((cellNode) => {
        return new TableCell({
          children: (cellNode.content ?? []).flatMap(nodeToDocx),
          verticalAlign: VerticalAlign.TOP,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          }
        })
      })
      return new TableRow({ children: cells })
    })
    if (rows.length === 0) {
      return []
    }
    return [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })]
  },
  mathInline: (node) => [new Paragraph({ children: [new TextRun(`$${node.attrs?.latex}$`)] })],
  mathBlock: (node) => [new Paragraph({ children: [new TextRun(`$$${node.attrs?.latex}$$`)] })],
  callout: (node) => {
    const variant = node.attrs?.variant ?? 'info'
    const colorMap = {
      info: 'EBF5FF',
      warning: 'FFFBEB',
      tip: 'F0FFF4',
      important: 'FFF5F5',
    }
    const shading = {
      type: ShadingType.CLEAR,
      fill: colorMap[variant as keyof typeof colorMap] || colorMap.info,
    }
    return (node.content ?? []).map(
      (p) =>
        new Paragraph({
          shading,
          children: (p.content ?? []).map(textNodeToDocx),
        }),
    )
  },
}

function textNodeToDocx(node: JSONContent): TextRun {
  const text = node.text ?? ''
  const marks = node.marks ?? []
  const props: any = {}

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold': props.bold = true; break
      case 'italic': props.italics = true; break
      case 'underline': props.underline = { type: UnderlineType.SINGLE }; break
      case 'strike': props.strike = true; break
      case 'code': props.font = 'Courier New'; break
    }
  }

  return new TextRun({ text, ...props })
}

function nodeToDocx(node: JSONContent): (Paragraph | Table)[] {
  if (!node || !node.type) return []
  const handler = nodeHandlers[node.type]
  if (handler) {
    return handler(node)
  }
  if (node.content) {
    return node.content.flatMap(nodeToDocx)
  }
  return []
}

const defaultStyles = {
    paragraphStyles: [
        { id: 'SourceCode', name: 'Source Code', basedOn: 'Normal', next: 'Normal', run: { font: { name: 'Courier New' } } },
        { id: 'IntenseQuote', name: 'Intense Quote', basedOn: 'Normal', next: 'Normal', run: { color: '5A5A5A' }, paragraph: { indent: { left: 720 } } },
    ],
}
const defaultNumbering = {
    config: [{ reference: 'default-numbering', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }] }],
}

export async function generateDocx(prosemirrorJSON: JSONContent, title: string): Promise<Blob> {
  const children = nodeToDocx(prosemirrorJSON)
  const doc = new Document({
    creator: 'Niko-Studio',
    title,
    styles: defaultStyles,
    numbering: defaultNumbering,
    sections: [{
      properties: {},
      children: [new Paragraph({ text: title, heading: HeadingLevel.TITLE }), ...children],
    }],
  })

  return Packer.toBlob(doc)
}

export async function generateProjectDocx(projectId: string, projectTitle: string): Promise<Blob> {
  const { getChaptersForProject, volumesByProjectId } = useAppStore.getState()
  const allChapters = getChaptersForProject(projectId)
  const volumes = volumesByProjectId[projectId] ?? []

  const sections: { properties: {}, children: (Paragraph | Table)[] }[] = []

  for (const vol of volumes) {
    const chaptersInVol = allChapters.filter(c => c.volumeId === vol.id)
    if (chaptersInVol.length === 0) continue

    sections.push({
      properties: {},
      children: [new Paragraph({ text: vol.title, heading: HeadingLevel.HEADING_1 })],
    })

    for (const chapter of chaptersInVol) {
      const contentStr = await readChapterContent(projectId, chapter.id)
      const content = contentStr ? (JSON.parse(contentStr) as JSONContent) : { type: 'doc', content: [] }
      
      sections.push({
        properties: {},
        children: [
            new Paragraph({ text: chapter.title, heading: HeadingLevel.HEADING_2 }), 
            ...nodeToDocx(content)
        ],
      })
    }
  }
  
  const doc = new Document({
    creator: 'Niko-Studio',
    title: projectTitle,
    styles: defaultStyles,
    numbering: defaultNumbering,
    sections: sections.length > 0 ? sections : [ { properties:{}, children: [] } ]
  });

  return Packer.toBlob(doc);
}
