import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'

interface EvaluationPanelProps {
  content: string
  onClose: () => void
}

interface EvaluationResult {
  score: number
  dimensions: {
    name: string
    score: number
    feedback: string
  }[]
  suggestions: string[]
  decision: 'APPROVED' | 'REVISE' | 'REWRITE'
}

export function EvaluationPanel({ content, onClose }: EvaluationPanelProps) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<EvaluationResult | null>(null)

  useEffect(() => {
    evaluateContent()
  }, [content])

  const evaluateContent = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://127.0.0.1:8000/critic/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('Evaluation failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-100'
    if (score >= 6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getDecisionStyle = (decision: string) => {
    switch (decision) {
      case 'APPROVED':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: '通过' }
      case 'REVISE':
        return { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', label: '需修改' }
      case 'REWRITE':
        return { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: '需重写' }
      default:
        return { icon: AlertCircle, color: 'text-gray-600', bg: 'bg-gray-50', label: '未知' }
    }
  }

  if (loading) {
    return (
      <div className="fixed right-0 top-12 bottom-0 w-80 bg-white border-l shadow-lg p-4">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="fixed right-0 top-12 bottom-0 w-80 bg-white border-l shadow-lg p-4">
        <div className="text-center text-gray-400">评估失败</div>
      </div>
    )
  }

  const decisionStyle = getDecisionStyle(result.decision)
  const DecisionIcon = decisionStyle.icon

  return (
    <div className="fixed right-0 top-12 bottom-0 w-80 bg-white border-l shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-600" />
          <span className="font-semibold">质量评估</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      {/* Overall Score */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">综合评分</span>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(result.score)}`}>
            {result.score.toFixed(1)} / 10
          </div>
        </div>
        <div className={`flex items-center gap-2 p-3 rounded-lg ${decisionStyle.bg}`}>
          <DecisionIcon size={20} className={decisionStyle.color} />
          <span className={`font-medium ${decisionStyle.color}`}>{decisionStyle.label}</span>
        </div>
      </div>

      {/* Dimensions */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">维度分析</h3>
        <div className="space-y-3">
          {result.dimensions.map((dim, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{dim.name}</span>
                <span className={`text-sm font-medium ${dim.score >= 7 ? 'text-green-600' : dim.score >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {dim.score}/10
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full ${dim.score >= 7 ? 'bg-green-500' : dim.score >= 5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${dim.score * 10}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{dim.feedback}</p>
            </div>
          ))}
        </div>

        {/* Suggestions */}
        {result.suggestions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <TrendingUp size={16} />
              改进建议
            </h3>
            <ul className="space-y-2">
              {result.suggestions.map((suggestion, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
