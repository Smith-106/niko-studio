import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { Search, Filter, Maximize2, Minimize2, Columns, LayoutGrid, GitBranch } from 'lucide-react'
import { useState } from 'react'
import type { KnowledgeGraphViewMode, GraphLayoutAlgorithm } from '@/stores/knowledgeGraphStore'

const layoutOptions: { value: GraphLayoutAlgorithm; label: string; icon: React.ReactNode }[] = [
  { value: 'force-directed', label: '力导向', icon: <GitBranch size={14} /> },
  { value: 'radial', label: '径向', icon: <Maximize2 size={14} /> },
  { value: 'hierarchical', label: '层级', icon: <LayoutGrid size={14} /> },
]

const viewOptions: { value: KnowledgeGraphViewMode; label: string; icon: React.ReactNode }[] = [
  { value: 'hidden', label: '关闭', icon: <Minimize2 size={14} /> },
  { value: 'fullscreen', label: '全屏', icon: <Maximize2 size={14} /> },
  { value: 'split', label: '分屏', icon: <Columns size={14} /> },
  { value: 'sidebar', label: '侧栏', icon: <LayoutGrid size={14} /> },
]

export function KnowledgeGraphToolbar() {
  const { filterState, layoutAlgorithm, viewMode, updateFilter, setLayout, setViewMode, nodes, edges } =
    useKnowledgeGraphStore()
  const [showFilter, setShowFilter] = useState(false)

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-gray-800">
      <div className="flex items-center gap-1 flex-1">
        <Search size={14} className="text-gray-400" />
        <input
          type="text"
          value={filterState.searchQuery}
          onChange={(e) => updateFilter({ searchQuery: e.target.value })}
          placeholder="搜索节点..."
          className="bg-gray-700 text-gray-200 text-sm px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none w-48"
        />
      </div>

      <button
        onClick={() => setShowFilter(!showFilter)}
        className={`p-1.5 rounded ${showFilter ? 'bg-gray-600' : 'hover:bg-gray-700'}`}
        title="过滤"
      >
        <Filter size={14} className="text-gray-300" />
      </button>

      <div className="flex items-center gap-0.5 bg-gray-700 rounded">
        {layoutOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setLayout(opt.value)}
            className={`px-2 py-1 text-xs rounded ${layoutAlgorithm === opt.value ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
            title={opt.label}
          >
            {opt.icon}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-0.5 bg-gray-700 rounded">
        {viewOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setViewMode(opt.value)}
            className={`px-2 py-1 text-xs rounded ${viewMode === opt.value ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
            title={opt.label}
          >
            {opt.icon}
          </button>
        ))}
      </div>

      <span className="text-xs text-gray-500">
        {nodes.length} 节点 · {edges.length} 边
      </span>
    </div>
  )
}