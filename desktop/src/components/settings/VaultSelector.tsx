import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderOpen, RefreshCw, Check, AlertCircle } from 'lucide-react'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

interface VaultInfo {
  path: string
  name: string
  has_obsidian_config: boolean
}

export function VaultSelector() {
  const [vaults, setVaults] = useState<VaultInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { obsidianVaultPath, setVaultPath, setSyncStatus } = useKnowledgeGraphStore()

  const discoverVaults = async () => {
    setLoading(true)
    setError(null)
    try {
      const found = await invoke<VaultInfo[]>('list_vaults')
      setVaults(found)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const selectVault = async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      setSyncStatus('syncing')
      const info = await invoke<VaultInfo>('select_vault', { vaultPath: path })
      setVaultPath(info.path)
      setSyncStatus('synced')
    } catch (e) {
      setError(String(e))
      setSyncStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const browseVault = async () => {
    const selected = await open({ directory: true, title: '选择 Obsidian Vault 目录' })
    if (selected) {
      await selectVault(selected)
    }
  }

  useEffect(() => {
    discoverVaults()
  }, [])

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-200">Obsidian Vault</h3>
        <button
          onClick={discoverVaults}
          className="p-1 rounded hover:bg-gray-700"
          title="刷新"
        >
          <RefreshCw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {vaults.length > 0 ? (
        <div className="space-y-1">
          {vaults.map((vault) => (
            <button
              key={vault.path}
              onClick={() => selectVault(vault.path)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left ${
                obsidianVaultPath === vault.path
                  ? 'bg-blue-600/20 border border-blue-500/50'
                  : 'hover:bg-gray-700 border border-transparent'
              }`}
            >
              {obsidianVaultPath === vault.path ? (
                <Check size={14} className="text-blue-400 shrink-0" />
              ) : (
                <FolderOpen size={14} className="text-gray-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-gray-200 truncate">{vault.name}</div>
                <div className="text-xs text-gray-500 truncate">{vault.path}</div>
              </div>
              {!vault.has_obsidian_config && (
                <span className="text-xs text-yellow-500 ml-auto shrink-0">非标准</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">未发现 Obsidian Vault，请手动选择</p>
      )}

      <button
        onClick={browseVault}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-dashed border-gray-600 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-200"
      >
        <FolderOpen size={14} />
        手动选择目录
      </button>
    </div>
  )
}