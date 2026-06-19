import { describe, expect, it } from 'vitest'

import {
  buildFailurePresentation,
  buildFailurePresentationResult,
  buildRuntimeDiagnosticPresentation,
  buildRuntimeDiagnosticSummary,
  extractFailureDiagnostic,
} from './failurePresentation'

const categoryTranslations = {
  failureCategoryGeneration: 'Generation failed',
  failureCategoryEvaluation: 'Evaluation failed',
  failureCategoryRetrieval: 'Retrieval failed',
  failureCategoryConnection: 'Connection failed',
  failureMessageGeneration: 'The generation request did not finish.',
  failureMessageEvaluation: 'The evaluation step is unavailable.',
  failureMessageRetrieval: 'Reference material could not be loaded.',
  failureMessageConnection: 'The local service connection is unstable.',
}

const runtimeTranslations = {
  runtimeUnavailableLabel: 'Runtime unavailable',
  runtimeUnavailableMessage: 'Start the runtime.',
  packagedPrerequisiteMissingLabel: 'Missing packaged prerequisite',
  packagedPrerequisiteMissingMessage: 'Install the packaged prerequisite.',
  embeddingAuthorityUnavailableLabel: 'Embedding authority unavailable',
  embeddingAuthorityUnavailableMessage: 'Restore embedding authority.',
  parserMissingLabel: 'Document parser missing',
  parserMissingMessage: 'Install the required parser.',
  integrationDegradedLabel: 'Integration degraded',
  integrationDegradedMessage: 'Fix the degraded integration.',
  mcpFetchFailed: 'Fetch failed',
}

describe('extractFailureDiagnostic', () => {
  it('prefers direct diagnostics and normalizes snake_case failure class names', () => {
    expect(extractFailureDiagnostic({
      diagnostics: {
        failure_class: 'packaged_prerequisite_missing',
        summary: 'Packaged runtime is missing',
        detail: 'The packaged helper was not found.',
        action: 'Reinstall the packaged runtime.',
      },
      errorData: {
        mcp_runtime: {
          diagnostic: {
            failureClass: 'runtime_unavailable',
            detail: 'Should not win over direct diagnostics.',
          },
        },
      },
    })).toEqual({
      failureClass: 'packaged_prerequisite_missing',
      summary: 'Packaged runtime is missing',
      detail: 'The packaged helper was not found.',
      action: 'Reinstall the packaged runtime.',
      prerequisite: null,
    })
  })

  it('derives parser diagnostics from parser prerequisite error data', () => {
    expect(extractFailureDiagnostic({
      errorData: {
        error_code: 'ASYNC_PARSER_REQUIRED',
        detail: 'mammoth is required',
        action: 'Install mammoth and retry.',
        dependency: 'mammoth',
        service: 'docx',
      },
    })).toEqual({
      failureClass: 'parser_missing',
      summary: 'mammoth is required',
      detail: 'mammoth is required',
      action: 'Install mammoth and retry.',
      prerequisite: {
        kind: 'parser',
        dependency: 'mammoth',
        service: 'docx',
        detail: 'mammoth is required',
        action: 'Install mammoth and retry.',
      },
    })
  })

  it('returns null when neither direct nor derived diagnostics are available', () => {
    expect(extractFailureDiagnostic({
      diagnostics: 'not-an-object' as never,
      errorData: {
        error_code: 'UNRELATED',
      },
    })).toBeNull()
  })
})

describe('buildRuntimeDiagnosticPresentation', () => {
  it.each([
    ['runtime_unavailable', 'Runtime unavailable', 'Start the runtime.', 'danger'],
    ['packaged_prerequisite_missing', 'Missing packaged prerequisite', 'Install the packaged prerequisite.', 'danger'],
    ['embedding_authority_unavailable', 'Embedding authority unavailable', 'Restore embedding authority.', 'warning'],
    ['integration_degraded', 'Integration degraded', 'Fix the degraded integration.', 'warning'],
  ] as const)(
    'maps %s to the correct presentation copy',
    (failureClass, label, message, tone) => {
      expect(buildRuntimeDiagnosticPresentation(
        {
          message: 'Gateway request failed',
          diagnostics: {
            failureClass,
          },
        },
        runtimeTranslations,
      )).toEqual({
        label,
        message,
        detail: 'Gateway request failed',
        action: null,
        tone,
        failureClass,
      })
    },
  )

  it('falls back to prerequisite action when the top-level diagnostic action is missing', () => {
    expect(buildRuntimeDiagnosticPresentation(
      {
        message: 'Parser is unavailable',
        diagnostics: {
          failureClass: 'parser_missing',
          summary: 'mammoth is required',
          prerequisite: {
            action: 'Install mammoth and retry.',
          },
        },
      },
      runtimeTranslations,
    )).toEqual({
      label: 'Document parser missing',
      message: 'Install the required parser.',
      detail: 'mammoth is required',
      action: 'Install mammoth and retry.',
      tone: 'warning',
      failureClass: 'parser_missing',
    })
  })

  it('returns null when no failure class is available', () => {
    expect(buildRuntimeDiagnosticPresentation(
      {
        message: 'Unknown failure',
      },
      runtimeTranslations,
    )).toBeNull()
  })
})

describe('buildRuntimeDiagnosticSummary', () => {
  it('maps parser_missing diagnostics to actionable summary copy', () => {
    expect(buildRuntimeDiagnosticSummary(
      {
        message: 'mammoth is required',
        diagnostics: {
          failureClass: 'parser_missing',
          detail: 'mammoth is required',
          action: 'Install mammoth and retry.',
        },
      },
      runtimeTranslations,
    )).toEqual({
      title: 'Document parser missing',
      detail: 'mammoth is required',
      action: 'Install mammoth and retry.',
      tone: 'warning',
      failureClass: 'parser_missing',
    })
  })
})

describe('buildFailurePresentationResult', () => {
  it('prefers runtime diagnostic messaging when structured diagnostics are available', () => {
    expect(buildFailurePresentationResult(
      {
        message: 'Gateway request failed',
        diagnostics: {
          failureClass: 'runtime_unavailable',
          summary: 'Gateway runtime is offline',
        },
      },
      runtimeTranslations,
    )).toEqual({
      message: 'Start the runtime.',
      detail: 'Gateway runtime is offline',
      diagnostic: {
        failureClass: 'runtime_unavailable',
        summary: 'Gateway runtime is offline',
        detail: null,
        action: null,
        prerequisite: null,
      },
    })
  })

  it('falls back to fetch copy when neither message nor diagnostic detail is available', () => {
    expect(buildFailurePresentationResult(
      {
        message: '   ',
      },
      runtimeTranslations,
    )).toEqual({
      message: 'Fetch failed',
      detail: null,
      diagnostic: null,
    })
  })
})

describe('buildFailurePresentation', () => {
  it('classifies retrieval-oriented failures from the detail text', () => {
    expect(buildFailurePresentation({
      t: categoryTranslations,
      error: 'knowledge retrieval request failed',
    })).toMatchObject({
      category: 'retrieval',
      label: categoryTranslations.failureCategoryRetrieval,
      message: categoryTranslations.failureMessageRetrieval,
    })
  })

  it('classifies evaluation failures from the source when the text is generic', () => {
    expect(buildFailurePresentation({
      t: categoryTranslations,
      source: 'evaluation',
      error: 'Request failed',
    })).toMatchObject({
      category: 'evaluation',
      label: categoryTranslations.failureCategoryEvaluation,
      message: categoryTranslations.failureMessageEvaluation,
    })
  })

  it('prioritizes connection failures when the request cannot reach the service', () => {
    expect(buildFailurePresentation({
      t: categoryTranslations,
      source: 'evaluation',
      error: 'Failed to fetch',
    })).toMatchObject({
      category: 'connection',
      label: categoryTranslations.failureCategoryConnection,
      message: categoryTranslations.failureMessageConnection,
    })
  })

  it('falls back to generation copy and uses the first non-empty detail source', () => {
    expect(buildFailurePresentation({
      t: categoryTranslations,
      error: { message: 'ignored object' },
      fallbackMessage: '  Rewrite request stalled.  ',
      diagnostics: 'auxiliary note should not override fallback detail',
    })).toEqual({
      category: 'generation',
      label: categoryTranslations.failureCategoryGeneration,
      message: categoryTranslations.failureMessageGeneration,
      detail: 'Rewrite request stalled.',
    })
  })
})
