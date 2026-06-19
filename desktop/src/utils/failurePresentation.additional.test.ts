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

describe('failurePresentation additional coverage', () => {
  it('returns null for a missing diagnostic input', () => {
    expect(extractFailureDiagnostic(null)).toBeNull()
  })

  it('reads direct errorData diagnostics and preserves prerequisite objects', () => {
    expect(extractFailureDiagnostic({
      errorData: {
        diagnostic: {
          failureClass: 'integration_degraded',
          summary: 'Bridge degraded',
          detail: 'The bridge is lagging.',
          action: 'Restart the bridge.',
          prerequisite: {
            kind: 'integration',
            service: 'workflow-bridge',
            action: 'Restart the bridge.',
          },
        },
      },
    })).toEqual({
      failureClass: 'integration_degraded',
      summary: 'Bridge degraded',
      detail: 'The bridge is lagging.',
      action: 'Restart the bridge.',
      prerequisite: {
        kind: 'integration',
        service: 'workflow-bridge',
        action: 'Restart the bridge.',
      },
    })
  })

  it('falls back to runtime diagnostics and normalizes unknown failure classes to null', () => {
    expect(extractFailureDiagnostic({
      errorData: {
        diagnostic: 'invalid' as never,
        mcp_runtime: {
          diagnostic: {
            failureClass: 'not-real' as never,
            summary: '  Runtime payload exists  ',
            detail: '  Runtime detail  ',
            action: '  Retry runtime  ',
          },
        },
      },
    })).toEqual({
      failureClass: null,
      summary: 'Runtime payload exists',
      detail: 'Runtime detail',
      action: 'Retry runtime',
      prerequisite: null,
    })
  })

  it('derives parser diagnostics with default summary and parser fallback dependency', () => {
    expect(extractFailureDiagnostic({
      errorData: {
        error_code: 'PARSER_PREREQUISITE_MISSING',
        detail: '   ',
        action: '   ',
        dependency: null,
        parser: 'pdfjs',
        service: null,
      },
    })).toEqual({
      failureClass: 'parser_missing',
      summary: 'Parser prerequisite is missing.',
      detail: null,
      action: null,
      prerequisite: {
        kind: 'parser',
        dependency: 'pdfjs',
        service: null,
        detail: null,
        action: null,
      },
    })
  })

  it('falls back to a null parser dependency when neither dependency field is present', () => {
    expect(extractFailureDiagnostic({
      errorData: {
        error_code: 'ASYNC_PARSER_REQUIRED',
        detail: 'Parser package missing',
        dependency: null,
        parser: null,
      },
    })).toEqual({
      failureClass: 'parser_missing',
      summary: 'Parser package missing',
      detail: 'Parser package missing',
      action: null,
      prerequisite: {
        kind: 'parser',
        dependency: null,
        service: null,
        detail: 'Parser package missing',
        action: null,
      },
    })
  })

  it('falls back to the raw input message when diagnostic detail is empty', () => {
    expect(buildRuntimeDiagnosticPresentation(
      {
        message: 'Gateway recovered with warnings',
        diagnostics: {
          failureClass: 'integration_degraded',
        },
      },
      runtimeTranslations,
    )).toEqual({
      label: 'Integration degraded',
      message: 'Fix the degraded integration.',
      detail: 'Gateway recovered with warnings',
      action: null,
      tone: 'warning',
      failureClass: 'integration_degraded',
    })
  })

  it('returns null summary when no diagnostic presentation can be built', () => {
    expect(buildRuntimeDiagnosticSummary(
      {
        message: 'Unknown failure',
      },
      runtimeTranslations,
    )).toBeNull()
  })

  it('uses the plain message when no structured runtime presentation exists', () => {
    expect(buildFailurePresentationResult(
      {
        message: '  Retry later  ',
      },
      runtimeTranslations,
    )).toEqual({
      message: 'Retry later',
      detail: 'Retry later',
      diagnostic: null,
    })
  })

  it('uses diagnostics as the detail fallback when error and fallback message are empty', () => {
    expect(buildFailurePresentation({
      t: categoryTranslations,
      error: undefined,
      fallbackMessage: '   ',
      diagnostics: '  Reference sync stalled  ',
    })).toEqual({
      category: 'retrieval',
      label: categoryTranslations.failureCategoryRetrieval,
      message: categoryTranslations.failureMessageRetrieval,
      detail: 'Reference sync stalled',
    })
  })
})
