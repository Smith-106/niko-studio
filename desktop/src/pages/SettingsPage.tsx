import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface ProviderConfig {
  id: string
  name: string
  type: 'openai' | 'anthropic' | 'ollama' | 'custom'
  apiBase: string
  apiKey: string
  models: string[]
  enabled: boolean
}

const PRESETS: ProviderConfig[] = [
  { id: 'openai', name: 'OpenAI', type: 'openai', apiBase: 'https://api.openai.com/v1', apiKey: '', models: ['gpt-4o', 'gpt-4o-mini', 'o3'], enabled: false },
  { id: 'anthropic', name: 'Anthropic', type: 'anthropic', apiBase: 'https://api.anthropic.com', apiKey: '', models: ['claude-sonnet-4-6', 'claude-opus-4-7'], enabled: false },
  { id: 'ollama', name: 'Ollama (本地)', type: 'ollama', apiBase: 'http://127.0.0.1:11434', apiKey: '', models: ['qwen2.5:14b', 'deepseek-r1:14b'], enabled: false },
  { id: 'deepseek', name: 'DeepSeek', type: 'openai', apiBase: 'https://api.deepseek.com/v1', apiKey: '', models: ['deepseek-chat', 'deepseek-reasoner'], enabled: false },
]

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>(PRESETS)
  const [nowledgeHost, setNowledgeHost] = useState('127.0.0.1')
  const [nowledgePort, setNowledgePort] = useState('19828')
  const [tab, setTab] = useState<'providers' | 'nowledge' | 'general'>('providers')

  const toggleProvider = (id: string) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p))
  }

  const updateApiKey = (id: string, key: string) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, apiKey: key } : p))
  }

  return (
    <div className="flex h-screen bg-zinc-900 text-zinc-100">
      {/* 侧栏导航 */}
      <aside className="w-48 border-r border-zinc-800 p-3 space-y-1">
        <h2 className="text-sm font-bold text-zinc-300 mb-3">设置</h2>
        {(['providers', 'nowledge', 'general'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`w-full text-left text-xs px-3 py-2 rounded ${tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:bg-zinc-800'}`}>
            {{ providers: 'AI 模型提供商', nowledge: 'Nowledge Mem', general: '通用设置' }[t]}
          </button>
        ))}
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {tab === 'providers' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">AI 模型提供商</h3>
            <p className="text-xs text-zinc-500">配置一个或多个 LLM 提供商即可开始使用。推荐先配置 Ollama（免费本地运行）。</p>
            {providers.map(p => (
              <div key={p.id} className={`rounded-lg border p-4 ${p.enabled ? 'border-zinc-600 bg-zinc-800/50' : 'border-zinc-800 bg-zinc-900'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleProvider(p.id)}
                      className={`w-4 h-4 rounded border ${p.enabled ? 'bg-blue-500 border-blue-500' : 'border-zinc-600'}`} />
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-[10px] text-zinc-600">{p.type}</span>
                  </div>
                  <span className={`text-[10px] ${p.enabled ? 'text-green-400' : 'text-zinc-600'}`}>
                    {p.enabled ? '已启用' : '未启用'}
                  </span>
                </div>
                {p.enabled && (
                  <div className="space-y-2 mt-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">API Base URL</label>
                      <input value={p.apiBase} readOnly
                        className="w-full text-xs bg-zinc-900 rounded px-2 py-1 text-zinc-300 border border-zinc-700" />
                    </div>
                    {p.type !== 'ollama' && (
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">API Key</label>
                        <input type="password" value={p.apiKey} onChange={e => updateApiKey(p.id, e.target.value)}
                          placeholder="sk-..." className="w-full text-xs bg-zinc-900 rounded px-2 py-1 text-zinc-300 border border-zinc-700" />
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">可用模型</label>
                      <div className="flex flex-wrap gap-1">
                        {p.models.map(m => (
                          <span key={m} className="text-[10px] bg-zinc-800 rounded px-1.5 py-0.5 text-zinc-400">{m}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'nowledge' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Nowledge Mem 知识层</h3>
            <p className="text-xs text-zinc-500">Nowledge Mem 是本地优先的知识管理层，提供 LLM Wiki、记忆衰减、跨工具上下文等功能。</p>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">主机</label>
              <input value={nowledgeHost} onChange={e => setNowledgeHost(e.target.value)}
                className="w-64 text-xs bg-zinc-900 rounded px-2 py-1 text-zinc-300 border border-zinc-700" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">端口</label>
              <input value={nowledgePort} onChange={e => setNowledgePort(e.target.value)}
                className="w-32 text-xs bg-zinc-900 rounded px-2 py-1 text-zinc-300 border border-zinc-700" />
            </div>
            <button onClick={() => invoke('get_nowledge_status')}
              className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500">
              测试连接
            </button>
          </div>
        )}

        {tab === 'general' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">通用设置</h3>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">写作语言</label>
              <select className="text-xs bg-zinc-900 rounded px-2 py-1 text-zinc-300 border border-zinc-700">
                <option value="zh-CN">简体中文</option>
                <option value="zh-TW">繁體中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">主题</label>
              <select className="text-xs bg-zinc-900 rounded px-2 py-1 text-zinc-300 border border-zinc-700">
                <option value="dark">深色</option>
                <option value="light">浅色</option>
                <option value="system">跟随系统</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">质量门禁级别</label>
              <select className="text-xs bg-zinc-900 rounded px-2 py-1 text-zinc-300 border border-zinc-700">
                <option value="quick">快速（即时反馈）</option>
                <option value="standard">标准（日常写作）</option>
                <option value="strict">严格（发布前）</option>
              </select>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
