import { useState, useCallback } from 'react'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import {
  FileText,
  Link2,
  Sparkles,
  Copy,
  Eye,
  ZoomIn,
  ExternalLink,
} from 'lucide-react'

interface ContextMenuProps {
  nodeId: string
  x: number
  y: number
  onClose: () => void
}

export function GraphContextMenu({ nodeId, x, y, onClose }: ContextMenuProps) {
  const { nodes, selectNode } = useKnowledgeGraphStore()
  const node = nodes.find((n) => n.id === nodeId)

  const handleAction = useCallback(
    (action: string) => {
      switch (action) {
        case 'open':
          selectNode(nodeId)
          break
        case 'focus':
          selectNode(nodeId)
          break
        case 'copy-wikilink':
          if (node) {
            navigator.clipboard.writeText(`[[${node.label}]]`)
          }
          break
        case 'ai-summary':
          window.dispatchEvent(
            new CustomEvent('graph-node-action', {
              detail: { action: 'ai-summary', nodeId },
            }),
          )
          break
        case 'hide':
          window.dispatchEvent(
            new CustomEvent('graph-node-action', {
              detail: { action: 'hide', nodeId },
            }),
          )
          break
      }
      onClose()
    },
    [nodeId, node, selectNode, onClose],
  )

  if (!node) return null

  const menuItems = [
    { action: 'open', label: '打开笔记', icon: <FileText size={14} /> },
    { action: 'focus', label: '聚焦此节点', icon: <ZoomIn size={14} /> },
    { action: 'copy-wikilink', label: '复制 Wikilink', icon: <Copy size={14} /> },
    { action: 'ai-summary', label: 'AI 摘要', icon: <Sparkles size={14} /> },
    { action: 'hide', label: '从图谱隐藏', icon: <Eye size={14} /> },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-40"
        style={{ left: x, top: y }}
      >
        <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-700 truncate">
          {node.label}
        </div>
        {menuItems.map((item) => (
          <button
            key={item.action}
            onClick={() => handleAction(item.action)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white text-left"
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
