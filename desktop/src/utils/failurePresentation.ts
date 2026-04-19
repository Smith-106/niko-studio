export type FailureCategory = 'generation' | 'evaluation' | 'retrieval' | 'connection'

export interface FailurePresentationTranslations {
  failureCategoryGeneration: string
  failureCategoryEvaluation: string
  failureCategoryRetrieval: string
  failureCategoryConnection: string
  failureMessageGeneration: string
  failureMessageEvaluation: string
  failureMessageRetrieval: string
  failureMessageConnection: string
}

export interface FailurePresentation {
  category: FailureCategory
  label: string
  message: string
  detail: string | null
}

interface BuildFailurePresentationOptions {
  t: FailurePresentationTranslations
  source?: 'chat' | 'evaluation' | 'retrieval'
  error?: unknown
  fallbackMessage?: string | null
  diagnostics?: string | null
}

function normalizeFailureText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function resolveFailureCategory(source: BuildFailurePresentationOptions['source'], text: string): FailureCategory {
  if (/(failed to fetch|network|timed?\s*out|timeout|econn|socket|offline|connection|connect|gateway|backend|请求失败|网络|超时|连接|服务未启动)/i.test(text)) {
    return 'connection'
  }

  if (/(retriev|rag|knowledge|search|graph|vector|canon|context|memory|reference|检索|资料|知识|图谱|上下文|设定)/i.test(text)) {
    return 'retrieval'
  }

  if (source === 'evaluation' || /(evaluat|critic|quality|review|评估|评分|质量检查|审阅)/i.test(text)) {
    return 'evaluation'
  }

  return 'generation'
}

export function buildFailurePresentation({
  t,
  source = 'chat',
  error,
  fallbackMessage,
  diagnostics,
}: BuildFailurePresentationOptions): FailurePresentation {
  const detail = normalizeFailureText(error)
    ?? normalizeFailureText(fallbackMessage)
    ?? normalizeFailureText(diagnostics)
  const text = [detail, normalizeFailureText(diagnostics), normalizeFailureText(fallbackMessage)]
    .filter((value): value is string => Boolean(value))
    .join(' ')
  const category = resolveFailureCategory(source, text)

  if (category === 'connection') {
    return {
      category,
      label: t.failureCategoryConnection,
      message: t.failureMessageConnection,
      detail,
    }
  }

  if (category === 'retrieval') {
    return {
      category,
      label: t.failureCategoryRetrieval,
      message: t.failureMessageRetrieval,
      detail,
    }
  }

  if (category === 'evaluation') {
    return {
      category,
      label: t.failureCategoryEvaluation,
      message: t.failureMessageEvaluation,
      detail,
    }
  }

  return {
    category,
    label: t.failureCategoryGeneration,
    message: t.failureMessageGeneration,
    detail,
  }
}
