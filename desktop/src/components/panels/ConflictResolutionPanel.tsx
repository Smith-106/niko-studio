import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { AlertTriangle, Check, X, ArrowLeftRight } from 'lucide-react'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

interface ConflictItem {
  id: string
  note_path: string
  detected_at: number
}

export function ConflictResolutionPanel() {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [vaultContent, setVaultContent] = useState('')
  const [knowledgeContent, setKnowledgeContent] = useState('')
  const { obsidianVaultPath } = useKnowledgeGraphStore()

  const loadConflicts = async () => {
    try {
      const result = await invoke<ConflictItem[]>('get_sync_conflicts', { vaultPath: obsidianVaultPath })
      setConflicts(result)
    } catch {
      // No conflicts or vault not connected
    }
  }

  useEffect(() => {
    loadConflicts()
  }, [obsidianVaultPath])

  const resolveConflict = async (id: string, resolution: 'vault-wins' | 'knowledge-wins') => {
    try {
      await invoke('resolve_sync_conflict', { id, resolution })
      setConflicts((prev) => prev.filter((c) => c.id !== id))
      setSelectedId(null)
    } catch {
      // Handle error
    }
  }

  if (conflicts.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Check size={20} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">无同步冲突</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-700 flex items-center gap-2">
        <AlertTriangle size={16} className="text-yellow-500" />
        <span className="text-sm font-medium text-gray-200">
          {conflicts.length} 个冲突待解决
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className="px-3 py-2 border-b border-gray-800 hover:bg-gray-800 cursor-pointer"
            onClick={() => setSelectedId(conflict.id === selectedId ? null : conflict.id)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-200 truncate">{conflict.note_path}</span>
              <span className="text-xs text-gray-500">
                {new Date(conflict.detected_at).toLocaleString()}
              </span>
            </div>

            {selectedId === conflict.id && (
              <div className="mt-2 space-y-2">
                <div className="bg-gray-900 p-2 rounded text-xs">
                  <div className="text-purple-400 mb-1">Vault 版本</div>
                  <pre className="text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {vaultContent || '(加载中...)'}
                  </pre>
                </div>
                <div className="bg-gray-900 p-2 rounded text-xs">
                  <div className="text-blue-400 mb-1">Niko Studio 版本</div>
                  <pre className="text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {knowledgeContent || '(加载中...)'}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      resolveConflict(conflict.id, 'vault-wins')
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-500"
                  >
                    <ArrowLeftRight size={10} />
                    采用 Vault
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      resolveConflict(conflict.id, 'knowledge-wins')
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
                  >
                    <ArrowLeftRight size={10} />
                    采用 Niko
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedId(null)
                    }}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
