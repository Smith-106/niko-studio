import { useState, useEffect } from 'react'
import { Search, Plus, Folder, FileText, User, MapPin, BookOpen, Sparkles } from 'lucide-react'
import { searchMemory, queryGraph } from '../api/client'

interface KnowledgeModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'characters' | 'locations' | 'plots' | 'skills'

export function KnowledgeModal({ isOpen, onClose }: KnowledgeModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('characters')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadItems()
    }
  }, [isOpen, activeTab])

  const loadItems = async () => {
    setLoading(true)
    try {
      switch (activeTab) {
        case 'characters':
          const charResult = await queryGraph('MATCH (c:Character) RETURN c LIMIT 50')
          setItems(charResult.data?.nodes || [])
          break
        case 'locations':
          const locResult = await queryGraph('MATCH (l:Location) RETURN l LIMIT 50')
          setItems(locResult.data?.nodes || [])
          break
        case 'plots':
          const plotResult = await searchMemory('plot outline', 50)
          setItems(plotResult.data || [])
          break
        case 'skills':
          // Skills are loaded from local files
          setItems([
            { name: 'character-forge', description: '角色塑造' },
            { name: 'suspense-craft', description: '悬念张力' },
            { name: 'dialogue-system', description: '对话系统' },
            { name: 'tension-arc', description: '张力曲线' },
            { name: 'emotion-arc', description: '情感弧光' },
            { name: 'opening-craft', description: '开篇技巧' },
            { name: 'ending-craft', description: '结尾技巧' },
            { name: 'conflict-escalation', description: '冲突升级' },
          ])
          break
      }
    } catch (error) {
      console.error('Failed to load items:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = items.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isOpen) return null

  const tabs = [
    { id: 'characters' as TabType, label: '角色', icon: User },
    { id: 'locations' as TabType, label: '地点', icon: MapPin },
    { id: 'plots' as TabType, label: '剧情', icon: BookOpen },
    { id: 'skills' as TabType, label: '技能', icon: Sparkles },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[800px] h-[600px] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">📚 知识库</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              加载中...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Folder size={48} className="mb-2" />
              <p>暂无数据</p>
              <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus size={16} />
                添加{tabs.find(t => t.id === activeTab)?.label}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredItems.map((item, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      {activeTab === 'characters' && <User size={20} className="text-blue-600" />}
                      {activeTab === 'locations' && <MapPin size={20} className="text-blue-600" />}
                      {activeTab === 'plots' && <FileText size={20} className="text-blue-600" />}
                      {activeTab === 'skills' && <Sparkles size={20} className="text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 truncate">
                        {item.name || item.title || `Item ${index + 1}`}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {item.description || item.content || '暂无描述'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
