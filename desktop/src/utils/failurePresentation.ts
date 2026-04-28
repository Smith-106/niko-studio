import type {
  FailurePresentationDiagnostic,
  FailurePresentationErrorData,
  FailurePresentationInput,
  FailurePresentationResult,
  GatewayFailureClass,
  RuntimeDiagnosticPresentation,
  RuntimeDiagnosticSummary,
  RuntimePresentationTranslations,
} from '../api/contracts'

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

function isGatewayFailureClass(value: unknown): value is GatewayFailureClass {
  return value === 'runtime_unavailable'
    || value === 'packaged_prerequisite_missing'
    || value === 'embedding_authority_unavailable'
    || value === 'parser_missing'
    || value === 'integration_degraded'
}

function normalizeFailureDiagnostic(value: unknown): FailurePresentationDiagnostic | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const rawFailureClass = record.failureClass ?? record.failure_class
  const prerequisite = record.prerequisite && typeof record.prerequisite === 'object'
    ? record.prerequisite as FailurePresentationDiagnostic['prerequisite']
    : null

  return {
    failureClass: isGatewayFailureClass(rawFailureClass) ? rawFailureClass : null,
    summary: normalizeFailureText(record.summary),
    detail: normalizeFailureText(record.detail),
    action: normalizeFailureText(record.action),
    prerequisite,
  }
}

function diagnosticFromErrorData(errorData?: FailurePresentationErrorData | null): FailurePresentationDiagnostic | null {
  const direct = normalizeFailureDiagnostic(errorData?.diagnostic)
  if (direct) return direct

  const runtimeDiagnostic = normalizeFailureDiagnostic(errorData?.mcp_runtime?.diagnostic)
  if (runtimeDiagnostic) return runtimeDiagnostic

  if (errorData?.error_code === 'PARSER_PREREQUISITE_MISSING' || errorData?.error_code === 'ASYNC_PARSER_REQUIRED') {
    return {
      failureClass: 'parser_missing',
      summary: normalizeFailureText(errorData.detail) ?? 'Parser prerequisite is missing.',
      detail: normalizeFailureText(errorData.detail),
      action: normalizeFailureText(errorData.action),
      prerequisite: {
        kind: 'parser',
        dependency: errorData.dependency ?? errorData.parser ?? null,
        service: errorData.service ?? null,
        detail: normalizeFailureText(errorData.detail),
        action: normalizeFailureText(errorData.action),
      },
    }
  }

  return null
}

function getFailureMatrixEntry(
  failureClass: GatewayFailureClass,
  t: RuntimePresentationTranslations,
): Pick<RuntimeDiagnosticPresentation, 'label' | 'message' | 'tone'> {
  if (failureClass === 'runtime_unavailable') {
    return {
      label: t.runtimeUnavailableLabel,
      message: t.runtimeUnavailableMessage,
      tone: 'danger',
    }
  }

  if (failureClass === 'packaged_prerequisite_missing') {
    return {
      label: t.packagedPrerequisiteMissingLabel,
      message: t.packagedPrerequisiteMissingMessage,
      tone: 'danger',
    }
  }

  if (failureClass === 'embedding_authority_unavailable') {
    return {
      label: t.embeddingAuthorityUnavailableLabel,
      message: t.embeddingAuthorityUnavailableMessage,
      tone: 'warning',
    }
  }

  if (failureClass === 'parser_missing') {
    return {
      label: t.parserMissingLabel,
      message: t.parserMissingMessage,
      tone: 'warning',
    }
  }

  return {
    label: t.integrationDegradedLabel,
    message: t.integrationDegradedMessage,
    tone: 'warning',
  }
}

export function extractFailureDiagnostic(input?: FailurePresentationInput | null): FailurePresentationDiagnostic | null {
  if (!input) return null
  return normalizeFailureDiagnostic(input.diagnostics) ?? diagnosticFromErrorData(input.errorData)
}

export function buildRuntimeDiagnosticPresentation(
  input: FailurePresentationInput,
  t: RuntimePresentationTranslations,
): RuntimeDiagnosticPresentation | null {
  const diagnostic = extractFailureDiagnostic(input)
  if (!diagnostic?.failureClass) return null

  const matrix = getFailureMatrixEntry(diagnostic.failureClass, t)
  return {
    label: matrix.label,
    message: matrix.message,
    detail: diagnostic.detail ?? diagnostic.summary ?? normalizeFailureText(input.message),
    action: diagnostic.action ?? diagnostic.prerequisite?.action ?? null,
    tone: matrix.tone,
    failureClass: diagnostic.failureClass,
  }
}

export function buildRuntimeDiagnosticSummary(
  input: FailurePresentationInput,
  t: RuntimePresentationTranslations,
): RuntimeDiagnosticSummary | null {
  const presentation = buildRuntimeDiagnosticPresentation(input, t)
  if (!presentation) return null

  return {
    title: presentation.label,
    detail: presentation.detail,
    action: presentation.action,
    tone: presentation.tone,
    failureClass: presentation.failureClass,
  }
}

export function buildFailurePresentationResult(
  input: FailurePresentationInput,
  t: RuntimePresentationTranslations,
): FailurePresentationResult {
  const presentation = buildRuntimeDiagnosticPresentation(input, t)
  const detail = presentation?.detail ?? normalizeFailureText(input.message) ?? null

  return {
    message: presentation?.message ?? normalizeFailureText(input.message) ?? t.mcpFetchFailed,
    detail,
    diagnostic: extractFailureDiagnostic(input),
  }
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
