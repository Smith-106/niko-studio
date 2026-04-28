export type Language = 'zh' | 'en'

export interface Translations {
  // App
  appTitle: string
  serviceRunning: string
  serviceOffline: string
  contextUsage: string
  checkpoint: string
  restore: string
  restoreSuccess: string
  restoreSuccessWithCheckpoint: string
  restoreFailed: string
  loadingCheckpoints: string
  noCheckpoints: string
  contextEstimated: string

  // Sidebar
  nikoStudio: string
  newChat: string
  chatList: string
  skillPacks: string
  knowledgeBase: string
  settings: string
  skipToMainContent: string

  // Chat
  startWriting: string
  startWritingDesc: string
  chatStarterHint: string
  chatStarterContinue: string
  chatStarterRewrite: string
  chatStarterExpand: string
  chatStarterAlignCanon: string
  chatStarterCheckIssues: string
  thinking: string
  workflow: string
  quick: string
  lite: string
  standard: string
  brainstorm: string
  coordinator: string
  planning: string
  selectedSkills: string
  inputPlaceholder: string
  streamCanceled: string
  streamInterrupted: string
  streamRecovered: string
  streamReconnecting: string
  streamRestoreHint: string
  streamRestoreToBeforeSend: string
  streamRetryLastSend: string
  streamCopyError: string
  streamErrorCopied: string
  streamRestoreBeforeSendSuccess: string
  inlineNeedSelection: string
  inlineActionFailed: string
  inlineSelectedTextInfo: string
  inlineContinue: string
  inlineRevise: string
  inlineGenerate: string
  inlineRun: string
  inlineClearSelection: string
  inlineReviseDefaultInstruction: string
  inlineContinuePromptPrefix: string
  inlineGeneratePromptPrefix: string
  inlineGenerateContextFallback: string
  streamGateSoftGo: string
  streamGateNoGo: string
  streamGovernanceRecovered: string
  streamGovernanceReviewReady: string
  templateLibraryEntry: string
  templateLibraryTitle: string
  templateClosePanel: string
  templateCategoryAll: string
  templateCategoryBrainstorm: string
  templateCategoryOutline: string
  templateCategoryCharacter: string
  templateCategoryRewrite: string
  templateCategoryAnalysis: string
  templateCategoryCustom: string
  templateFavorite: string
  templateUnfavorite: string
  templateFavoriteOnlyOn: string
  templateFavoriteOnlyOff: string
  templateSearchPlaceholder: string
  templateRequiredHint: string
  templateApplyAction: string
  templateApplyReplace: string
  templateApplyAppend: string
  templateEmptyList: string
  templateNoMatch: string
  processingCompleted: string
  serviceUnavailableRetry: string
  backendConnectionFailed: string
  sessionCreateFailedRetry: string
  uploadUnsupportedFormat: string
  uploadInjectionFailedRetry: string
  uploadStageReading: string
  uploadStageUploading: string
  uploadStageInjecting: string
  uploadErrorFormat: string
  uploadErrorSize: string
  uploadErrorNetwork: string
  uploadErrorPrerequisite: string
  uploadErrorService: string
  uploadInjectedChunks: string
  uploadInjectedContext: string
  uploadMultipleProgress: string
  uploadMultipleComplete: string
  chatAgentContextPrefix: string
  quickRollbackTitle: string
  quickRollbackAdvancedToggle: string
  quickRollbackPlanIdPlaceholder: string
  quickRollbackCheckpointIdPlaceholder: string
  quickRollbackReasonPlaceholder: string
  quickRollbackAction: string
  quickRollbackSuccess: string
  quickRollbackFailed: string
  quickRollbackMissingRequired: string
  quickRollbackSummary: string

  // Knowledge Modal
  knowledgeTitle: string
  knowledgeClose: string
  knowledgeTabCharacters: string
  knowledgeTabLocations: string
  knowledgeTabPlots: string
  knowledgeTabSkills: string
  knowledgeTaskLookup: string
  knowledgeTaskAugment: string
  knowledgeTaskReference: string
  knowledgeTaskLookupHint: string
  knowledgeTaskAugmentHint: string
  knowledgeTaskReferenceHint: string
  knowledgeTaskScopeTitle: string
  knowledgeTaskScopeEmpty: string
  knowledgeTaskBrowseTitle: string
  knowledgeTaskBrowseHint: string
  knowledgeTaskAugmentMemory: string
  knowledgeTaskAugmentSkills: string
  knowledgeTaskSkillsHint: string
  knowledgeSearchPlaceholder: string
  knowledgeTaskMatch: string
  knowledgeSkillDetails: string
  knowledgeSkillChain: string
  knowledgeCurrentSkill: string
  knowledgeLoading: string
  knowledgeEmpty: string
  knowledgeAddPrefix: string
  knowledgeNoDescription: string
  knowledgeItemFallback: string
  knowledgePromoteCanon: string
  knowledgePromotingCanon: string
  knowledgePromoteCanonSuccess: string
  knowledgePromoteCanonFailure: string
  knowledgeSkillDetailsLoadFailed: string
  knowledgeTemporalTitle: string
  knowledgeTemporalEntityPlaceholder: string
  knowledgeTemporalAtTimePlaceholder: string
  knowledgeTemporalAction: string
  knowledgeTemporalEntityRequired: string
  knowledgeTemporalLoaded: string
  knowledgeCharacterTitle: string
  knowledgeCharacterNamePlaceholder: string
  knowledgeCharacterAction: string
  knowledgeCharacterNameRequired: string
  knowledgeCharacterLoaded: string
  knowledgeForeshadowTitle: string
  knowledgeForeshadowStatusPlaceholder: string
  knowledgeForeshadowStatusPending: string
  knowledgeForeshadowStatusResolved: string
  knowledgeForeshadowStatusAll: string
  knowledgeForeshadowChapterPlaceholder: string
  knowledgeForeshadowAction: string
  knowledgeForeshadowsLoaded: string
  knowledgeMemoryTitle: string
  knowledgeMemoryContentPlaceholder: string
  knowledgeMemoryLayerPlaceholder: string
  knowledgeMemoryDimensionPlaceholder: string
  knowledgeMemoryEntityPlaceholder: string
  knowledgeMemoryTagsPlaceholder: string
  knowledgeMemoryAction: string
  knowledgeMemoryContentRequired: string
  knowledgeMemoryAdded: string
  knowledgeRequestFailed: string

  // Evaluation Panel
  evaluationTitle: string
  evaluationClose: string
  evaluationFailed: string
  failureCategoryGeneration: string
  failureCategoryEvaluation: string
  failureCategoryRetrieval: string
  failureCategoryConnection: string
  failureMessageGeneration: string
  failureMessageEvaluation: string
  failureMessageRetrieval: string
  failureMessageConnection: string
  evaluationNoContent: string
  evaluationOverallScore: string
  evaluationDimensionAnalysis: string
  evaluationSuggestions: string
  evaluationBatchApply: string
  evaluationBatchUndo: string
  evaluationApply: string
  evaluationUndo: string
  evaluationApplying: string
  evaluationUndoing: string
  evaluationBatchApplying: string
  evaluationBatchUndoing: string
  evaluationBatchResult: string
  evaluationBatchUndoResult: string
  evaluationPassed: string
  evaluationNeedRevise: string
  evaluationNeedRewrite: string
  evaluationUnknown: string
  evaluationNoFeedback: string
  evaluationDimensionLock: string
  evaluationDimensionStyle: string
  evaluationDimensionLogic: string
  evaluationActionFailedWithReason: string
  evaluationRecommendationFallback: string
  evaluationCheckpointTitle: string
  evaluationCheckpointPlaceholder: string
  evaluationRefresh: string
  evaluationSuggestionsRefresh: string
  evaluationSuggestionsRefreshing: string
  evaluationSuggestionsRefreshFailed: string
  evaluationQualityCheckTitle: string
  evaluationQualityCheckRun: string
  evaluationQualityCheckRunning: string
  evaluationQualityCheckFailed: string
  evaluationQualityCheckDecision: string
  evaluationQualityCheckTotal: string
  evaluationQualityCheckLock: string
  evaluationQualityCheckStyle: string
  evaluationQualityCheckLogic: string
  evaluationQualityCheckFeedback: string
  evaluationConsistencyTitle: string
  evaluationConsistencyRun: string
  evaluationConsistencyRunning: string
  evaluationConsistencyFailed: string
  evaluationConsistencySummary: string
  evaluationConsistencyScore: string
  evaluationConsistencyConflicts: string
  evaluationConsistencyRunId: string
  evaluationWorkflowTitle: string
  evaluationWorkflowTaskPlaceholder: string
  evaluationWorkflowLevelPlaceholder: string
  evaluationWorkflowPlanIdPlaceholder: string
  evaluationWorkflowStepIdPlaceholder: string
  evaluationWorkflowLifecycleActionLabel: string
  evaluationWorkflowLifecycleStatus: string
  evaluationWorkflowLifecycleStart: string
  evaluationWorkflowLifecyclePause: string
  evaluationWorkflowLifecycleResume: string
  evaluationWorkflowLifecycleStop: string
  evaluationWorkflowRoute: string
  evaluationWorkflowPlan: string
  evaluationWorkflowExecute: string
  evaluationWorkflowLifecycle: string
  evaluationWorkflowRetry: string
  evaluationWorkflowLoading: string
  evaluationWorkflowSuccess: string
  evaluationWorkflowError: string
  evaluationWorkflowPlanIdRequired: string
  evaluationWorkflowWaitingConfirmation: string
  evaluationWorkflowGateReason: string
  evaluationWorkflowConfirmTokenPlaceholder: string
  evaluationWorkflowConfirmAndContinue: string
  evaluationWorkflowConfirmTokenRequired: string

  // Chat Area Controls
  chatModeLabel: string
  chatModeNormal: string
  chatModeAgent: string
  chatModeComparison: string
  modePresetsLabel: string
  modePresetFocusWriting: string
  modePresetAgentDiagnose: string
  modePresetCompareReview: string
  showMore: string
  showLess: string
  chatComparisonModelLabel: string
  messageBubblePrimaryModelLabel: string
  messageBubbleControlModelLabel: string
  messageBubbleDiffHighlightsLabel: string
  messageBubbleAcceptPrimary: string
  messageBubbleAcceptControl: string
  messageBubbleSourceSummaryTitle: string
  messageBubbleSourceSummaryUsed: string
  messageBubbleSourceSummaryFallback: string
  messageBubbleSourcePrimary: string
  messageBubbleSourceTypeCanon: string
  messageBubbleSourceTypeEntity: string
  messageBubbleSourceTypeRelation: string
  messageBubbleSourceTypeMemory: string
  messageBubbleRetrievalStatus: string
  messageBubbleCanonContextTitle: string
  messageBubbleCanonContextApplied: string
  messageBubbleCanonContextUnavailable: string
  messageBubblePromoteCanon: string
  messageBubblePromotingCanon: string
  messageBubblePromoteCanonSuccess: string
  messageBubblePromoteCanonFailure: string
  chatAgentActionWrite: string
  chatAgentActionRevise: string
  chatAgentActionContext: string
  composerUpload: string
  composerVoiceInput: string
  voiceInputStatusLabel: string
  composerSend: string

  // Sidebar
  sidebarToggleExpand: string
  sidebarToggleCollapse: string
  chatSidebarToggleExpand: string
  chatSidebarToggleCollapse: string
  storyBibleTitle: string
  storyBibleDesc: string
  storyBibleBraindump: string
  storyBibleBraindumpHint: string
  storyBibleGenre: string
  storyBibleGenrePlaceholder: string
  storyBibleSynopsis: string
  storyBibleSynopsisPlaceholder: string
  storyBibleCharacters: string
  storyBibleWorldbuilding: string
  storyBibleOutline: string
  storyBibleStyleTitle: string
  storyBibleStyleTried: string
  storyBibleStyleTriedDesc: string
  storyBibleStyleMatchMy: string
  storyBibleStyleMatchMyDesc: string
  storyBibleStyleSoundsLike: string
  storyBibleStyleSoundsLikeDesc: string
  storyBibleStyleCustom: string
  storyBibleStyleCustomDesc: string
  storyBibleGenerate: string
  storyBibleEmpty: string
  storyBibleLoading: string
  storyBiblePersistenceTitle: string
  storyBiblePersistenceLocalOnly: string
  storyBiblePersistenceGraphRead: string
  storyBibleExportDraft: string
  storyBibleImportDraft: string
  storyBibleResetDraft: string
  storyBibleDraftExported: string
  storyBibleDraftImported: string
  storyBibleDraftReset: string
  storyBibleDraftImportInvalid: string
  aiToolWrite: string
  aiToolRewrite: string
  aiToolDescribe: string
  aiToolBrainstorm: string
  sidebarWritingHelper: string
  sidebarMcpStatus: string
  sidebarEvaluationPanel: string
  skillGroupCore: string
  skillGroupStory: string
  skillGroupQuality: string
  skillGroupTools: string
  skillGroupEmpty: string
  skillDescriptionGeneric: string
  skillDescCharacterForge: string
  skillDescSuspenseCraft: string
  skillDescDialogueSystem: string
  skillDescTensionArc: string
  skillDescEmotionArc: string
  skillDescOpeningCraft: string
  skillDescEndingCraft: string
  skillDescConflictEscalation: string

  // App status
  serviceDegraded: string
  serviceReconnecting: string
  contextUsageLowHint: string
  contextUsageMediumHint: string
  contextUsageHighHint: string

  // Writing Helper panel
  writingHelperTitle: string
  writingHelperMode: string
  writingHelperModePolish: string
  writingHelperModeRewrite: string
  writingHelperModeExpand: string
  writingHelperModeSummarize: string
  writingHelperModeOutline: string
  writingHelperMaxSentences: string
  writingHelperMaxItems: string
  writingHelperInputText: string
  writingHelperInputPlaceholder: string

  // Settings modal
  settingsClose: string

  // Settings
  settingsTitle: string
  backendService: string
  backendUrl: string
  backendConfigTitle: string
  backendConfigDescription: string
  backendConfigLoading: string
  backendConfigSyncing: string
  backendConfigSyncSuccess: string
  backendConfigReload: string
  backendConfigSave: string
  backendConfigSaveSecrets: string
  backendConfigReadOnly: string
  backendConfigReadOnlyHint: string
  backendConfigSecretsTitle: string
  backendConfigSecretsDescription: string
  backendConfigShowSecret: string
  backendConfigHideSecret: string
  backendConfigConfigured: string
  backendConfigNotConfigured: string
  backendConfigNoConfig: string
  backendConfigNoSecrets: string
  backendConfigSectionAgent: string
  backendConfigSectionMemory: string
  backendConfigSectionWorkflow: string
  backendConfigSectionGraph: string
  backendConfigSectionWriting: string
  backendConfigSectionGateway: string
  backendConfigSectionBackup: string
  backendConfigSectionToken: string
  backendConfigSectionObsidian: string
  backendConfigSectionIntegration: string
  llmConfig: string
  multiModel: string
  primary: string
  testConnection: string
  testing: string
  apiKey: string
  baseUrl: string
  defaultModel: string
  setPrimary: string
  modelParams: string
  temperature: string
  temperatureDesc: string
  writingSettings: string
  defaultWorkflow: string
  workflowBackendMode: string
  workflowBackendModeStandard: string
  workflowBackendModeUiBridge: string
  workflowL1: string
  workflowL2: string
  workflowL3: string
  workflowL4: string
  workflowL5: string
  targetWords: string
  autoSkillMatch: string
  qualityGoalsTitle: string
  qualityGoalNaturalness: string
  qualityGoalReadability: string
  qualityGoalCoherence: string
  qualityGoalStyleConsistency: string
  qualityGoalPreset: string
  qualityPresetHumanWriting: string
  qualityPresetAiEditGuidance: string
  qualityPresetCustom: string
  qualityGoalSentenceEntropy: string
  qualityGoalRhythmVariability: string
  qualityGoalCustomInstruction: string
  qualityGoalCustomInstructionPlaceholder: string
  writingHelperLegacyPolish: string
  writingHelperClose: string
  writingHelperGuardStatus: string
  writingHelperGuardOn: string
  writingHelperGuardOff: string
  writingHelperHint: string
  writingHelperOpenSettings: string
  writingHelperModePrefix: string
  writingHelperRun: string
  writingHelperRunning: string
  writingHelperClearDraft: string
  writingHelperFailed: string
  writingHelperInsertToEditor: string

  // Style Settings (8 dimensions)
  styleSettingsTitle: string
  styleTone: string
  styleToneWarm: string
  styleToneFormal: string
  styleToneCasual: string
  styleToneHumorous: string
  styleToneSerious: string
  styleToneMelancholic: string
  styleFormality: string
  styleEmotion: string
  styleCreativity: string
  stylePerspective: string
  stylePerspectiveFirst: string
  stylePerspectiveThird: string
  stylePerspectiveSecond: string
  stylePerspectiveOmniscient: string
  styleSentence: string
  styleSentenceConcise: string
  styleSentenceFlowing: string
  styleSentenceVaried: string
  styleSentenceComplex: string
  styleRhythmLabel: string
  styleRhythmBrisk: string
  styleRhythmModerate: string
  styleRhythmLeisurely: string
  styleNarrativeDistance: string

  // Style sub-property labels
  styleAdvancedTitle: string
  styleStructure: string
  styleParagraphLength: string
  styleParagraphShort: string
  styleParagraphMedium: string
  styleParagraphLong: string
  styleParagraphVaried: string
  styleTransition: string
  styleTransitionSmooth: string
  styleTransitionDirect: string
  styleTransitionDramatic: string
  styleTransitionSubtle: string
  styleHierarchy: string
  styleHierarchyFlat: string
  styleHierarchyNested: string
  styleHierarchyParallel: string
  styleHierarchyProgressive: string
  styleEmotionExpression: string
  styleEmotionImplicit: string
  styleEmotionExplicit: string
  styleEmotionRestrained: string
  styleEmotionPassionate: string
  styleThinkingLogic: string
  styleThinkingDeductive: string
  styleThinkingInductive: string
  styleThinkingAnalogical: string
  styleThinkingDialectical: string
  styleThinkingDepth: string
  styleThinkingRhythm: string
  styleThinkingMethodical: string
  styleThinkingExploratory: string
  styleThinkingRapid: string
  styleThinkingContemplative: string
  styleNarrativeTime: string
  styleNarrativeTimeLinear: string
  styleNarrativeTimeFlashback: string
  styleNarrativeTimeInterleaved: string
  styleNarrativeTimeCircular: string
  styleNarrativeAttitude: string
  styleNarrativeObjective: string
  styleNarrativeSympathetic: string
  styleNarrativeCritical: string
  styleNarrativeDetached: string
  styleRhythmSyllable: string
  styleRhythmSyllableDense: string
  styleRhythmSyllableBalanced: string
  styleRhythmSyllableSparse: string
  styleRhythmSyllableFree: string
  styleRhythmPause: string
  styleRhythmPauseFrequent: string
  styleRhythmPauseModerate: string
  styleRhythmPauseMinimal: string
  styleRhythmTempo: string
  styleRhythmTempoFast: string
  styleRhythmTempoModerate: string
  styleRhythmTempoSlow: string
  styleRhythmTempoVaried: string
  styleTagAdd: string
  styleTagPlaceholder: string
  styleSignaturePhrases: string
  styleImagerySystem: string
  styleAllusions: string
  styleKnowledgeDomains: string
  styleVocabularyPreferred: string
  styleVocabularyAvoid: string
  styleUniqueness: string
  optimizerTwoStepMode: string
  optimizerTwoStepAnalysis: string

  // AI Text Optimizer
  optimizerTitle: string
  optimizerBadge: string
  optimizerPresetLabel: string
  optimizerPresetHumanize: string
  optimizerPresetHumanizeDesc: string
  optimizerPresetAiGuide: string
  optimizerPresetAiGuideDesc: string
  optimizerPresetCharacter: string
  optimizerPresetCharacterDesc: string
  optimizerPresetLiterary: string
  optimizerPresetLiteraryDesc: string
  optimizerPresetAcademic: string
  optimizerPresetAcademicDesc: string
  optimizerPresetCustom: string
  optimizerPresetCustomDesc: string
  optimizerCustomInstruction: string
  optimizerSourceLabel: string
  optimizerSourceSelection: string
  optimizerSourceSelectionHint: string
  optimizerSourceManual: string
  optimizerSourceManualHint: string
  optimizerSourceEmpty: string
  optimizerSourceEmptyHint: string
  optimizerRefreshFromSelection: string
  optimizerInputText: string
  optimizerInputPlaceholder: string
  optimizerRun: string
  optimizerRunning: string
  optimizerFailed: string
  optimizerResultTitle: string
  optimizerDiagnosisTitle: string
  optimizerDiagnosisHint: string
  optimizerFeaturePerplexity: string
  optimizerFeatureBurstiness: string
  optimizerFeatureDetection: string
  optimizerFeatureNatural: string
  sidebarTextOptimizer: string

  uiSettings: string
  theme: string
  themeLight: string
  themeDark: string
  themeSystem: string
  themeSorbet: string
  themeSlate: string
  themeAmber: string
  themeForest: string
  themeCharcoal: string
  themeCauldron: string
  themeAurora: string
  themeMoonbeam: string
  themeSepia: string
  fontSize: string
  fontSmall: string
  fontMedium: string
  fontLarge: string
  language: string
  langChinese: string
  langEnglish: string
  sendShortcutLabel: string
  sendShortcutEnter: string
  sendShortcutCtrlEnter: string
  resetDefault: string
  cancel: string
  save: string
  exportSettings: string
  importSettings: string
  importSuccess: string
  importFailed: string

  // MCP Status Panel
  mcpPanelAriaLabel: string
  mcpPanelTitle: string
  mcpRefresh: string
  mcpRefreshing: string
  mcpCloseAria: string
  mcpFetchPartialError: string
  mcpFetchFailed: string
  mcpProbeFailed: string
  mcpUpdateFailed: string
  mcpServiceIdRequired: string
  mcpCreateFailed: string
  mcpGatewayStatus: string
  mcpGatewayHealth: string
  mcpSessionId: string
  mcpNotAvailable: string
  mcpReconnect: string
  mcpLastErrorPrefix: string
  mcpKeyServiceStatus: string
  mcpServiceOnline: string
  mcpServiceNotReady: string
  mcpRuntimeMetrics: string
  mcpRequestsTotal: string
  mcpRequestsFailed: string
  mcpLatencyAvg: string
  mcpLatencyMax: string
  mcpNoMetricsData: string
  mcpServiceDynamicConfig: string
  mcpServiceIdPlaceholder: string
  mcpServiceNamePlaceholder: string
  mcpServicePathPlaceholder: string
  mcpCreating: string
  mcpCreateService: string
  mcpServiceEnabled: string
  mcpServiceDisabled: string
  mcpSaving: string
  mcpSaveName: string
  mcpDisable: string
  mcpEnable: string
  mcpBuiltinServiceCannotToggle: string
  mcpProbing: string
  mcpHealthCheck: string
  mcpNoServiceConfigData: string
  mcpToolStats: string
  mcpTotalTools: string
  mcpNoToolData: string
  mcpStatusOk: string
  mcpStatusError: string
  mcpStatusDisabled: string
  mcpStatusUnknown: string
  mcpConnectionConnected: string
  mcpConnectionDegraded: string
  mcpConnectionDisconnected: string
  mcpConnectionReconnecting: string
  mcpReconnectIdle: string
  mcpReconnectProbing: string
  mcpReconnectBackoff: string
  mcpReconnectRetrying: string
  mcpReconnectRecovered: string
  mcpReconnectFailed: string
  mcpRuntimeDiagnostics: string
  mcpDiagnosticClass: string
  runtimeUnavailableLabel: string
  runtimeUnavailableMessage: string
  packagedPrerequisiteMissingLabel: string
  packagedPrerequisiteMissingMessage: string
  embeddingAuthorityUnavailableLabel: string
  embeddingAuthorityUnavailableMessage: string
  parserMissingLabel: string
  parserMissingMessage: string
  integrationDegradedLabel: string
  integrationDegradedMessage: string

  // Settings Modal Diagnostics & Retrieval
  settingsDiagnostics: string
  settingsCheckConnection: string
  settingsRefreshDiagnostics: string
  settingsAdvancedSupport: string
  settingsAdvancedSupportHint: string
  settingsDetailedDiagnosticsHint: string
  settingsOpenDetailedDiagnostics: string
  settingsGatewayMetrics: string
  settingsToolList: string
  settingsNoMetricsData: string
  settingsNoToolsData: string
  settingsAllowFallback: string
  settingsDetectionGuard: string
  settingsRetrieval: string
  settingsRetrievalProviderModel: string
  settingsRetrievalSearchPlaceholder: string
  settingsEnableKnowledgeRetrieval: string
  settingsEnableRerank: string
  settingsModelSource: string
  settingsValidatingModel: string
  settingsValidateDefaultModel: string
  settingsRefreshModels: string
  settingsRefreshingModels: string
  settingsLastSync: string
  settingsCustomModel: string
  settingsCustomModelPlaceholder: string
  settingsUseThisModel: string
  settingsInvalidConfigFile: string
  settingsImportFailedPrefix: string
  settingsUnknownError: string
  settingsSaveSuccess: string
  settingsSavePartialFailure: string
  settingsSaveFailed: string
  settingsSaveStagePersisted: string
  settingsSaveStageRuntime: string
  settingsSaveStageValidation: string
  settingsSaveValidationFailed: string
  settingsModelNameRequired: string
  settingsModelNameTooLong: string
  settingsModelNameWhitespace: string
  settingsFetchModelsFailed: string
  settingsFetchModelsFailedWithReason: string
  settingsInvalidCustomModel: string
  settingsPresetModels: string
  settingsFetchedModels: string
  settingsCustomModels: string
  settingsDefaultModelValidateFetchFailed: string
  settingsDefaultModelAvailableViaGateway: string
  settingsDefaultModelAvailableViaDirect: string
  settingsDefaultModelUnavailable: string
  settingsDefaultModelValidateFailed: string
  settingsDiagnosticsFetchFailed: string
  settingsApiKeyPlaceholder: string
  settingsSearchMode: string
  settingsSearchModeHybrid: string
  settingsSearchModeIterative: string
  settingsSearchModeContext: string
  settingsRetrievalProfile: string
  settingsRetrievalProfilePlaceholder: string
  settingsRetrievalMinScore: string
  settingsRetrievalBudgetTokens: string
  settingsRetrievalMaxIterations: string
  settingsRetrievalConfidenceThreshold: string
  settingsAgentContextTypes: string
  settingsContextTypeWorld: string
  settingsContextTypeCharacter: string
  settingsContextTypePlot: string
  quickPanelTitle: string
  quickPanelResultsLabel: string
  quickPanelSearchPlaceholder: string
  quickPanelNoMatch: string
  quickPanelSelect: string
  quickPanelConfirm: string
  quickPanelClose: string
  contentSearchPlaceholder: string
  errorBoundaryTitle: string
  errorBoundaryDescription: string
  errorBoundaryTryAgain: string
  errorBoundaryReload: string
  streamErrorCategory: string
  scrollToBottom: string
  sidebarNewDocument: string
  sidebarContinueWriting: string
  sidebarDocuments: string
  mcpMetricTotal: string
  mcpMetricFailed: string
  mcpMetricAvgLatency: string
  mcpMetricMaxLatency: string
  editorWordCount: string
  editorCharCount: string
  editorReadingTime: string
  editorAutoSaved: string
  editorPlaceholder: string
  editorAiGenerating: string
  editorAiCancel: string
  // Slash commands
  editorCmdGenerate: string
  editorCmdGenerateDesc: string
  editorCmdContinue: string
  editorCmdContinueDesc: string
  editorCmdFullArticle: string
  editorCmdFullArticleDesc: string
  editorCmdHeading1: string
  editorCmdHeading1Desc: string
  editorCmdHeading2: string
  editorCmdHeading2Desc: string
  editorCmdHeading3: string
  editorCmdHeading3Desc: string
  editorCmdBulletList: string
  editorCmdBulletListDesc: string
  editorCmdOrderedList: string
  editorCmdOrderedListDesc: string
  editorCmdBlockquote: string
  editorCmdBlockquoteDesc: string
  editorCmdCodeBlock: string
  editorCmdCodeBlockDesc: string
  editorCmdHorizontalRule: string
  editorCmdHorizontalRuleDesc: string
  // Bubble toolbar
  editorBubbleBold: string
  editorBubbleItalic: string
  editorBubbleStrikethrough: string
  editorBubbleRewrite: string
  editorBubblePolish: string
  editorBubbleSimplify: string
  editorBubbleExpand: string
  editorBubbleFormal: string
  editorBubbleCasual: string
  editorBubbleContinue: string
  // Export
  exportMarkdown: string
  exportHtml: string

  // Sidebar writer workspace (extracted hardcoded strings)
  writerWorkspaceTitle: string
  writerWorkspaceHint: string
  writerStoryBibleLabel: string
  writerChapterLabel: string
  writerStoryBibleMetaLabel: string
  writerWorkspaceLabel: string

  // ChatArea starter actions (extracted hardcoded strings)
  starterContinueDesc: string
  starterRewriteDesc: string
  starterExpandDesc: string
  starterAlignCanonDesc: string
  starterCheckIssuesDesc: string
  starterContinuePrompt: string
  starterRewritePrompt: string
  starterExpandPrompt: string
  starterAlignCanonPrompt: string
  starterCheckIssuesPrompt: string
  writerContextTitle: string
  writerContextHint: string
  currentDocumentFallback: string
}

export const translations: Record<Language, Translations> = {
  zh: {
    // App
    appTitle: '小说创作助手',
    serviceRunning: '可以继续写作',
    serviceOffline: '当前不可用',
    contextUsage: '上下文',
    checkpoint: '还原点',
    restore: '恢复',
    restoreSuccess: '恢复成功',
    restoreSuccessWithCheckpoint: '已恢复到 checkpoint {checkpointId}',
    restoreFailed: '恢复失败',
    loadingCheckpoints: '加载还原点中...',
    noCheckpoints: '暂无还原点',
    contextEstimated: '估算',

    // Sidebar
    nikoStudio: 'Niko-Studio',
    newChat: '新对话',
    chatList: '对话列表',
    skillPacks: '技能包',
    knowledgeBase: '故事设定',
    settings: '设置',
    skipToMainContent: '跳到主内容',

    // Chat
    startWriting: '开始创作你的故事',
    startWritingDesc: '先选一个围绕当前文档的写作动作，再决定是否继续深入讨论。',
    chatStarterHint: '这些动作会优先围绕你当前的文档、章节和设定上下文。',
    chatStarterContinue: '继续当前文稿',
    chatStarterRewrite: '改写当前段落',
    chatStarterExpand: '扩写这个场景',
    chatStarterAlignCanon: '对齐现有设定',
    chatStarterCheckIssues: '检查当前问题',
    thinking: 'Niko 正在思考...',
    workflow: '工作流',
    quick: '快速',
    lite: '轻量',
    standard: '标准',
    brainstorm: '脑暴',
    coordinator: '编排',
    planning: '规划',
    selectedSkills: '已选 {count} 个技能',
    inputPlaceholder: '告诉我你想创作什么...',
    streamCanceled: '已取消本次生成。',
    streamInterrupted: '流式生成已中断。',
    streamRecovered: '已从流式降级恢复，结果可继续使用。',
    streamReconnecting: '连接恢复中，请稍候...',
    streamRestoreHint: '发送失败，可恢复到发送前状态。',
    streamRestoreToBeforeSend: '恢复到发送前',
    streamRetryLastSend: '重试发送',
    streamCopyError: '复制错误',
    streamErrorCopied: '（已复制）',
    streamRestoreBeforeSendSuccess: '已恢复到发送前状态。',
    inlineNeedSelection: '请先选中文本后再改写。',
    inlineActionFailed: '内联 AI 操作失败，请重试。',
    inlineSelectedTextInfo: '已选中文本（{count} 字符）',
    inlineContinue: '续写',
    inlineRevise: '改写',
    inlineGenerate: '生成',
    inlineRun: '执行',
    inlineClearSelection: '清除选区',
    inlineReviseDefaultInstruction: '请改写这段内容并保持原意。',
    inlineContinuePromptPrefix: '请基于以下内容继续写作：',
    inlineGeneratePromptPrefix: '请基于以下内容生成新文本：',
    inlineGenerateContextFallback: '根据当前对话上下文生成。',
    streamGateSoftGo: '已降级执行（Soft Go）：结果可用，建议继续关注。',
    streamGateNoGo: '当前结果未通过质量门（No-Go），请调整后重试。',
    streamGovernanceRecovered: '本次结果记录为已恢复执行，可继续使用并建议复核。',
    streamGovernanceReviewReady: '本次结果已附带一致性治理记录，可在回复卡片中查看。',
    templateLibraryEntry: '模板库',
    templateLibraryTitle: '模板库',
    templateClosePanel: '关闭模板库',
    templateCategoryAll: '全部',
    templateCategoryBrainstorm: '脑暴',
    templateCategoryOutline: '大纲',
    templateCategoryCharacter: '角色',
    templateCategoryRewrite: '改写',
    templateCategoryAnalysis: '分析',
    templateCategoryCustom: '自定义',
    templateFavorite: '收藏模板',
    templateUnfavorite: '取消收藏',
    templateFavoriteOnlyOn: '仅看收藏',
    templateFavoriteOnlyOff: '全部模板',
    templateSearchPlaceholder: '搜索模板标题或内容',
    templateRequiredHint: '该变量为必填项',
    templateApplyAction: '一键填充',
    templateApplyReplace: '替换输入框',
    templateApplyAppend: '追加到输入框',
    templateEmptyList: '暂无模板',
    templateNoMatch: '无匹配模板',
    processingCompleted: '处理完成',
    serviceUnavailableRetry: '服务暂不可用，请稍后重试',
    backendConnectionFailed: '后端连接失败，请检查设置',
    sessionCreateFailedRetry: '创建会话失败，请重试',
    uploadUnsupportedFormat: '不支持的文件格式，请上传 txt/md/pdf/docx',
    uploadInjectionFailedRetry: '文件注入失败，请重试',
    uploadStageReading: '读取文件中...',
    uploadStageUploading: '上传文件中...',
    uploadStageInjecting: '注入上下文中...',
    uploadErrorFormat: '文件格式不支持',
    uploadErrorSize: '文件过大或超出限制',
    uploadErrorNetwork: '网络错误，请检查连接',
    uploadErrorPrerequisite: '缺少文档解析依赖或当前导入路径不支持该格式',
    uploadErrorService: '服务处理失败，请稍后重试',
    uploadInjectedChunks: '已完成文件上下文注入：{fileName}（{chunks} 段）',
    uploadInjectedContext: '文件已注入上下文：{fileName}（{chunks} 段）',
    uploadMultipleProgress: '正在处理文件 {current}/{total}...',
    uploadMultipleComplete: '已完成 {success}/{total} 个文件上传',
    chatAgentContextPrefix: 'Agent 上下文结果',
    quickRollbackTitle: '快速回滚',
    quickRollbackAdvancedToggle: '高级：快速回滚',
    quickRollbackPlanIdPlaceholder: '计划 ID',
    quickRollbackCheckpointIdPlaceholder: '检查点 ID',
    quickRollbackReasonPlaceholder: '回滚原因（可选）',
    quickRollbackAction: '执行回滚',
    quickRollbackSuccess: '快速回滚执行成功。',
    quickRollbackFailed: '快速回滚执行失败。',
    quickRollbackMissingRequired: '请填写计划 ID 与检查点 ID。',
    quickRollbackSummary: '默认写作流程通常不需要这里；只有需要按计划或检查点回退时再展开高级区。',

    // Knowledge Modal
    knowledgeTitle: '故事设定',
    knowledgeClose: '关闭故事设定',
    knowledgeTabCharacters: '角色',
    knowledgeTabLocations: '地点',
    knowledgeTabPlots: '剧情',
    knowledgeTabSkills: '技能',
    knowledgeTaskLookup: '查设定',
    knowledgeTaskAugment: '补资料',
    knowledgeTaskReference: '引用资料',
    knowledgeTaskLookupHint: '先查角色、地点和剧情设定，再决定下一步写法。',
    knowledgeTaskAugmentHint: '把新事实、伏笔和补充记忆写回当前项目，技能能力也收在这里。',
    knowledgeTaskReferenceHint: '先锁定这段写作要参考的对象，后续 AI 会优先围绕它继续工作。',
    knowledgeTaskScopeTitle: '当前写作范围',
    knowledgeTaskScopeEmpty: '当前还没有绑定明确项目，先浏览通用资料。',
    knowledgeTaskBrowseTitle: '设定分类',
    knowledgeTaskBrowseHint: '先从角色、地点和剧情里找到你要查看或引用的内容。',
    knowledgeTaskAugmentMemory: '记忆与线索',
    knowledgeTaskAugmentSkills: '技能辅助',
    knowledgeTaskSkillsHint: '技能库作为补资料时的辅助入口保留在这里，不再占用一级导航。',
    knowledgeSearchPlaceholder: '搜索...',
    knowledgeTaskMatch: '任务匹配',
    knowledgeSkillDetails: '技能详情',
    knowledgeSkillChain: '推荐链路',
    knowledgeCurrentSkill: '当前技能：{skillId}',
    knowledgeLoading: '加载中...',
    knowledgeEmpty: '暂无数据',
    knowledgeAddPrefix: '添加',
    knowledgeNoDescription: '暂无描述',
    knowledgeItemFallback: '条目 {index}',
    knowledgePromoteCanon: '提升到 Canon',
    knowledgePromotingCanon: '正在提升到 Canon…',
    knowledgePromoteCanonSuccess: '已将条目提升到 Canon。',
    knowledgePromoteCanonFailure: '提升条目到 Canon 失败。',
    knowledgeSkillDetailsLoadFailed: '加载技能详情失败',
    knowledgeTemporalTitle: '时间事实',
    knowledgeTemporalEntityPlaceholder: '实体ID',
    knowledgeTemporalAtTimePlaceholder: '时间点（可选，ISO 时间）',
    knowledgeTemporalAction: '查询时间事实',
    knowledgeTemporalEntityRequired: '请输入时间事实查询的实体ID。',
    knowledgeTemporalLoaded: '时间事实查询完成。',
    knowledgeCharacterTitle: '角色详情',
    knowledgeCharacterNamePlaceholder: '角色名',
    knowledgeCharacterAction: '查询角色详情',
    knowledgeCharacterNameRequired: '请输入角色名。',
    knowledgeCharacterLoaded: '角色详情加载完成。',
    knowledgeForeshadowTitle: '伏笔筛选',
    knowledgeForeshadowStatusPlaceholder: '状态',
    knowledgeForeshadowStatusPending: '待处理',
    knowledgeForeshadowStatusResolved: '已解决',
    knowledgeForeshadowStatusAll: '全部',
    knowledgeForeshadowChapterPlaceholder: '章节',
    knowledgeForeshadowAction: '查询伏笔',
    knowledgeForeshadowsLoaded: '伏笔查询完成。',
    knowledgeMemoryTitle: '添加记忆',
    knowledgeMemoryContentPlaceholder: '记忆内容',
    knowledgeMemoryLayerPlaceholder: '会话',
    knowledgeMemoryDimensionPlaceholder: '上下文',
    knowledgeMemoryEntityPlaceholder: '实体ID（可选）',
    knowledgeMemoryTagsPlaceholder: '标签（英文逗号分隔）',
    knowledgeMemoryAction: '添加记忆',
    knowledgeMemoryContentRequired: '请输入记忆内容。',
    knowledgeMemoryAdded: '记忆添加成功。',
    knowledgeRequestFailed: '请求失败，请稍后重试。',

    // Evaluation Panel
    evaluationTitle: '回复评估',
    evaluationClose: '关闭评估面板',
    evaluationFailed: '评估失败',
    failureCategoryGeneration: '生成失败',
    failureCategoryEvaluation: '评估失败',
    failureCategoryRetrieval: '资料拉取失败',
    failureCategoryConnection: '连接失败',
    failureMessageGeneration: '这次回复没有生成完成，你可以重试或先继续写。',
    failureMessageEvaluation: '当前评估步骤暂时不可用，你可以先继续写，再稍后重试。',
    failureMessageRetrieval: '这次没有成功取到参考资料，你可以稍后重试或先按当前内容继续写。',
    failureMessageConnection: '当前与本地服务连接异常，请检查服务状态后再重试。',
    evaluationNoContent: '还没有可评估的助手回复',
    evaluationOverallScore: '综合评分',
    evaluationDimensionAnalysis: '维度分析',
    evaluationSuggestions: '改进建议',
    evaluationBatchApply: '批量应用',
    evaluationBatchUndo: '批量撤销',
    evaluationApply: '应用',
    evaluationUndo: '撤销',
    evaluationApplying: '执行中...',
    evaluationUndoing: '撤销中...',
    evaluationBatchApplying: '批量执行中...',
    evaluationBatchUndoing: '批量撤销中...',
    evaluationBatchResult: '批量结果：成功 {applied}，失败 {failed}',
    evaluationBatchUndoResult: '批量撤销结果：成功 {success}，失败 {failed}',
    evaluationPassed: '通过',
    evaluationNeedRevise: '需修改',
    evaluationNeedRewrite: '需重写',
    evaluationUnknown: '未知',
    evaluationNoFeedback: '无',
    evaluationDimensionLock: '结构锁定',
    evaluationDimensionStyle: '风格',
    evaluationDimensionLogic: '逻辑',
    evaluationActionFailedWithReason: '{action}失败：{reason}',
    evaluationRecommendationFallback: '建议 {index}',
    evaluationCheckpointTitle: '检查点',
    evaluationCheckpointPlaceholder: '检查点描述',
    evaluationRefresh: '刷新',
    evaluationSuggestionsRefresh: '刷新建议',
    evaluationSuggestionsRefreshing: '刷新建议中...',
    evaluationSuggestionsRefreshFailed: '刷新建议失败，请稍后重试。',
    evaluationQualityCheckTitle: '小说质量检查',
    evaluationQualityCheckRun: '执行质量检查',
    evaluationQualityCheckRunning: '质量检查中...',
    evaluationQualityCheckFailed: '质量检查失败',
    evaluationQualityCheckDecision: '决策',
    evaluationQualityCheckTotal: '总分',
    evaluationQualityCheckLock: '结构锁定分',
    evaluationQualityCheckStyle: '风格分',
    evaluationQualityCheckLogic: '逻辑分',
    evaluationQualityCheckFeedback: '反馈',
    evaluationConsistencyTitle: '一致性治理',
    evaluationConsistencyRun: '执行一致性检查',
    evaluationConsistencyRunning: '一致性检查中...',
    evaluationConsistencyFailed: '一致性检查失败',
    evaluationConsistencySummary: '摘要',
    evaluationConsistencyScore: '综合评分',
    evaluationConsistencyConflicts: '冲突数',
    evaluationConsistencyRunId: '运行 ID',
    evaluationWorkflowTitle: '高级工作流',
    evaluationWorkflowTaskPlaceholder: '工作流任务',
    evaluationWorkflowLevelPlaceholder: '工作流级别（如 L3）',
    evaluationWorkflowPlanIdPlaceholder: '计划 ID',
    evaluationWorkflowStepIdPlaceholder: '步骤 ID（可选）',
    evaluationWorkflowLifecycleActionLabel: '生命周期动作',
    evaluationWorkflowLifecycleStatus: '状态',
    evaluationWorkflowLifecycleStart: '开始',
    evaluationWorkflowLifecyclePause: '暂停',
    evaluationWorkflowLifecycleResume: '继续',
    evaluationWorkflowLifecycleStop: '停止',
    evaluationWorkflowRoute: '路由',
    evaluationWorkflowPlan: '规划',
    evaluationWorkflowExecute: '执行',
    evaluationWorkflowLifecycle: '生命周期',
    evaluationWorkflowRetry: '重试',
    evaluationWorkflowLoading: '请求中...',
    evaluationWorkflowSuccess: '执行成功',
    evaluationWorkflowError: '执行失败',
    evaluationWorkflowPlanIdRequired: '请先填写 plan_id。',
    evaluationWorkflowWaitingConfirmation: '需要确认后才能继续。',
    evaluationWorkflowGateReason: '阻塞原因',
    evaluationWorkflowConfirmTokenPlaceholder: '确认令牌（confirm_token）',
    evaluationWorkflowConfirmAndContinue: '确认并继续',
    evaluationWorkflowConfirmTokenRequired: '请先填写 confirm_token。',

    // Chat Area Controls
    chatModeLabel: '模式：',
    chatModeNormal: '普通聊天',
    chatModeAgent: 'Agent 高级',
    chatModeComparison: '模型对比',
    modePresetsLabel: '预设：',
    modePresetFocusWriting: '专注写作',
    modePresetAgentDiagnose: 'Agent 诊断',
    modePresetCompareReview: '双模型校对',
    showMore: '更多',
    showLess: '收起',
    chatComparisonModelLabel: '对照模型',
    messageBubblePrimaryModelLabel: '主模型：',
    messageBubbleControlModelLabel: '对照模型：',
    messageBubbleDiffHighlightsLabel: '差异亮点',
    messageBubbleAcceptPrimary: '采纳主模型',
    messageBubbleAcceptControl: '采纳对照模型',
    messageBubbleSourceSummaryTitle: '本次参考',
    messageBubbleSourceSummaryUsed: '这次回复参考了 {summary}。',
    messageBubbleSourceSummaryFallback: '这次回复主要基于当前对话内容，没有额外展开资料。',
    messageBubbleSourcePrimary: '主要参考',
    messageBubbleSourceTypeCanon: '项目设定',
    messageBubbleSourceTypeEntity: '角色与要素',
    messageBubbleSourceTypeRelation: '关联线索',
    messageBubbleSourceTypeMemory: '历史记忆',
    messageBubbleRetrievalStatus: '检索状态： 实体 {entities} / 关系 {relations} / 记忆 {memories}',
    messageBubbleCanonContextTitle: 'Canon 来源',
    messageBubbleCanonContextApplied: '本次回复引用了 {matches} 条 canon 命中，来源于 {pages} 个已索引页面。',
    messageBubbleCanonContextUnavailable: '当前没能展开项目资料：{reason}',
    messageBubblePromoteCanon: '提升回复到 Canon',
    messageBubblePromotingCanon: '正在提升到 Canon…',
    messageBubblePromoteCanonSuccess: '已将回复提升到 Canon。',
    messageBubblePromoteCanonFailure: '提升回复到 Canon 失败。',
    chatAgentActionWrite: '写作',
    chatAgentActionRevise: '润色/重写',
    chatAgentActionContext: '取上下文',
    composerUpload: '上传文件',
    composerVoiceInput: '语音输入',
    voiceInputStatusLabel: '暂未开放',
    composerSend: '发送',

    // Sidebar
    sidebarToggleExpand: '展开侧边栏',
    sidebarToggleCollapse: '折叠侧边栏',
    chatSidebarToggleExpand: '展开聊天面板',
    chatSidebarToggleCollapse: '折叠聊天面板',
    storyBibleTitle: '故事圣经',
    storyBibleDesc: '记录你故事世界的关键细节，帮助 AI 生成更好的建议，或逐步完善你的创意直到完成初稿。',
    storyBibleBraindump: '灵感倾泻',
    storyBibleBraindumpHint: '写下你对故事所知的一切——情节、角色、世界观、主题，任何想法都可以！',
    storyBibleGenre: '题材类型',
    storyBibleGenrePlaceholder: '输入题材，如：奇幻、言情、悬疑...',
    storyBibleSynopsis: '故事概要',
    storyBibleSynopsisPlaceholder: '介绍角色、他们的目标、核心冲突，传达故事的基调和独特元素...',
    storyBibleCharacters: '角色',
    storyBibleWorldbuilding: '世界观',
    storyBibleOutline: '小说大纲',
    storyBibleStyleTitle: '写作风格',
    storyBibleStyleTried: '经典风格',
    storyBibleStyleTriedDesc: '经过验证的写作风格',
    storyBibleStyleMatchMy: '匹配我的风格',
    storyBibleStyleMatchMyDesc: '分析你的文字风格',
    storyBibleStyleSoundsLike: '听起来像',
    storyBibleStyleSoundsLikeDesc: '模仿指定作家的风格',
    storyBibleStyleCustom: '自定义',
    storyBibleStyleCustomDesc: '完全控制你的风格',
    storyBibleGenerate: '生成',
    storyBibleEmpty: '暂无内容',
    storyBibleLoading: '加载中...',
    storyBiblePersistenceTitle: '当前持久化边界',
    storyBiblePersistenceLocalOnly: 'local-only 草稿字段：braindump、genres、synopsis、outline、style 仅保存在当前设备的 localStorage 中。',
    storyBiblePersistenceGraphRead: 'graph-backed 只读列表：characters、locations 来自图谱查询，不包含在本地草稿 payload 中。',
    storyBibleExportDraft: '导出本地草稿',
    storyBibleImportDraft: '导入本地草稿',
    storyBibleResetDraft: '重置本地草稿',
    storyBibleDraftExported: 'Story Bible 本地草稿已导出。',
    storyBibleDraftImported: 'Story Bible 本地草稿已导入。',
    storyBibleDraftReset: 'Story Bible 本地草稿已重置。',
    storyBibleDraftImportInvalid: '导入的 Story Bible 草稿文件无效。',
    aiToolWrite: '写作',
    aiToolRewrite: '改写',
    aiToolDescribe: '描写',
    aiToolBrainstorm: '头脑风暴',
    sidebarWritingHelper: '写作助手',
    sidebarMcpStatus: '服务诊断',
    sidebarEvaluationPanel: '回复评估',
    skillGroupCore: '核心',
    skillGroupStory: '故事',
    skillGroupQuality: '质量',
    skillGroupTools: '工具',
    skillGroupEmpty: '暂无技能',
    skillDescriptionGeneric: '点击启用到当前对话',
    skillDescCharacterForge: '角色塑造',
    skillDescSuspenseCraft: '悬念张力',
    skillDescDialogueSystem: '对话系统',
    skillDescTensionArc: '张力曲线',
    skillDescEmotionArc: '情感弧光',
    skillDescOpeningCraft: '开篇技巧',
    skillDescEndingCraft: '结尾技巧',
    skillDescConflictEscalation: '冲突升级',

    // App status
    serviceDegraded: '部分功能需要重试',
    serviceReconnecting: '正在恢复连接',
    contextUsageLowHint: '上下文余量充足',
    contextUsageMediumHint: '上下文接近上限，建议精简输入',
    contextUsageHighHint: '上下文已接近满载，建议新建对话',

    // Writing Helper panel
    writingHelperTitle: '写作助手',
    writingHelperMode: '模式',
    writingHelperModePolish: '润色',
    writingHelperModeRewrite: '改写',
    writingHelperModeExpand: '扩写',
    writingHelperModeSummarize: '摘要',
    writingHelperModeOutline: '提纲',
    writingHelperMaxSentences: '最大句数（摘要）',
    writingHelperMaxItems: '最大条目（提纲）',
    writingHelperInputText: '输入文本',
    writingHelperInputPlaceholder: '请输入待处理文本',

    // Settings modal
    settingsClose: '关闭设置',

    // Settings
    settingsTitle: '设置',
    backendService: '连接与本地服务',
    backendUrl: '本地服务地址',
    backendConfigTitle: '本地服务设置',
    backendConfigDescription: '查看并编辑后端运行时配置。只读字段需要修改配置文件或重启服务。',
    backendConfigLoading: '加载配置中...',
    backendConfigSyncing: '同步中...',
    backendConfigSyncSuccess: '同步成功',
    backendConfigReload: '从文件重新加载',
    backendConfigSave: '保存更改',
    backendConfigSaveSecrets: '保存密钥',
    backendConfigReadOnly: '只读',
    backendConfigReadOnlyHint: '该字段需要修改配置文件或重启服务后生效',
    backendConfigSecretsTitle: '敏感字段',
    backendConfigSecretsDescription: '敏感字段会单独通过 secrets 接口保存。',
    backendConfigShowSecret: '显示',
    backendConfigHideSecret: '隐藏',
    backendConfigConfigured: '已配置',
    backendConfigNotConfigured: '未配置',
    backendConfigNoConfig: '暂无后端配置数据。',
    backendConfigNoSecrets: '当前没有可编辑的敏感字段。',
    backendConfigSectionAgent: 'Agent',
    backendConfigSectionMemory: 'Memory',
    backendConfigSectionWorkflow: 'Workflow',
    backendConfigSectionGraph: 'Graph',
    backendConfigSectionWriting: 'Writing',
    backendConfigSectionGateway: 'Gateway',
    backendConfigSectionBackup: 'Backup',
    backendConfigSectionToken: 'Token',
    backendConfigSectionObsidian: 'Obsidian',
    backendConfigSectionIntegration: 'Integration',
    llmConfig: 'LLM 模型配置',
    multiModel: '多模型并行',
    primary: '主要',
    testConnection: '测试连接',
    testing: '测试中...',
    apiKey: 'API Key',
    baseUrl: 'Base URL',
    defaultModel: '默认模型',
    setPrimary: '设为主要提供商',
    modelParams: '模型参数',
    temperature: 'Temperature (创造性)',
    temperatureDesc: '较低值 (0-0.3): 更确定性，适合事实性写作 | 较高值 (0.7-1): 更创造性，适合创意写作',
    writingSettings: '写作设置',
    defaultWorkflow: '默认工作流',
    workflowBackendMode: '工作流后端模式',
    workflowBackendModeStandard: '标准（/workflow/*）',
    workflowBackendModeUiBridge: 'UI 桥接（/ui-bridge/workflow/*）',
    workflowL1: 'L1 - 快速 (润色/问答)',
    workflowL2: 'L2 - 轻量 (短文/扩写)',
    workflowL3: 'L3 - 标准 (章节创作)',
    workflowL4: 'L4 - 脑暴 (多角度构思)',
    workflowL5: 'L5 - 编排 (全书设计)',
    targetWords: '每章目标字数',
    autoSkillMatch: '自动匹配技能包',
    qualityGoalsTitle: '质量增强目标',
    qualityGoalNaturalness: '自然度',
    qualityGoalReadability: '可读性',
    qualityGoalCoherence: '连贯性',
    qualityGoalStyleConsistency: '风格一致性',
    qualityGoalPreset: '优化预设',
    qualityPresetHumanWriting: '人类写作特征优化',
    qualityPresetAiEditGuidance: 'AI 修改指导',
    qualityPresetCustom: '自定义',
    qualityGoalSentenceEntropy: '句式熵目标',
    qualityGoalRhythmVariability: '节奏变化目标',
    qualityGoalCustomInstruction: '自定义优化指令',
    qualityGoalCustomInstructionPlaceholder: '输入你的个性化洗稿/润色要求',
    writingHelperLegacyPolish: '写作助手润色走旧版接口',
    writingHelperClose: '关闭',
    writingHelperGuardStatus: '检测规避拦截：{status}',
    writingHelperGuardOn: '开启',
    writingHelperGuardOff: '关闭',
    writingHelperHint: '可在“设置 → LLM 模型配置”中修改“检测规避拦截”开关。',
    writingHelperOpenSettings: '打开设置',
    writingHelperModePrefix: '模式：{mode}',
    writingHelperRun: '执行',
    writingHelperRunning: '处理中...',
    writingHelperClearDraft: '清空草稿',
    writingHelperFailed: '处理失败',
    writingHelperInsertToEditor: '插入到编辑器',

    // Style Settings
    styleSettingsTitle: '风格设置',
    styleTone: '情感基调',
    styleToneWarm: '温暖',
    styleToneFormal: '正式',
    styleToneCasual: '随性',
    styleToneHumorous: '幽默',
    styleToneSerious: '严肃',
    styleToneMelancholic: '忧郁',
    styleFormality: '正式程度',
    styleEmotion: '情感强度',
    styleCreativity: '创意度',
    stylePerspective: '叙事视角',
    stylePerspectiveFirst: '第一人称',
    stylePerspectiveThird: '第三人称',
    stylePerspectiveSecond: '第二人称',
    stylePerspectiveOmniscient: '全知视角',
    styleSentence: '句式风格',
    styleSentenceConcise: '简洁',
    styleSentenceFlowing: '流畅',
    styleSentenceVaried: '多变',
    styleSentenceComplex: '复杂',
    styleRhythmLabel: '节奏',
    styleRhythmBrisk: '明快',
    styleRhythmModerate: '适中',
    styleRhythmLeisurely: '舒缓',
    styleNarrativeDistance: '叙事距离',

    // Style sub-property labels
    styleAdvancedTitle: '高级风格设置',
    styleStructure: '结构',
    styleParagraphLength: '段落长度',
    styleParagraphShort: '短段落',
    styleParagraphMedium: '中等段落',
    styleParagraphLong: '长段落',
    styleParagraphVaried: '多变长度',
    styleTransition: '过渡风格',
    styleTransitionSmooth: '平滑',
    styleTransitionDirect: '直接',
    styleTransitionDramatic: '戏剧化',
    styleTransitionSubtle: '含蓄',
    styleHierarchy: '层次模式',
    styleHierarchyFlat: '扁平',
    styleHierarchyNested: '嵌套',
    styleHierarchyParallel: '并列',
    styleHierarchyProgressive: '递进',
    styleEmotionExpression: '表达风格',
    styleEmotionImplicit: '含蓄',
    styleEmotionExplicit: '外露',
    styleEmotionRestrained: '克制',
    styleEmotionPassionate: '热烈',
    styleThinkingLogic: '思维逻辑',
    styleThinkingDeductive: '演绎',
    styleThinkingInductive: '归纳',
    styleThinkingAnalogical: '类比',
    styleThinkingDialectical: '辩证',
    styleThinkingDepth: '思维深度',
    styleThinkingRhythm: '思维节奏',
    styleThinkingMethodical: '条理',
    styleThinkingExploratory: '探索',
    styleThinkingRapid: '快速',
    styleThinkingContemplative: '沉思',
    styleNarrativeTime: '时间序列',
    styleNarrativeTimeLinear: '线性',
    styleNarrativeTimeFlashback: '倒叙',
    styleNarrativeTimeInterleaved: '交错',
    styleNarrativeTimeCircular: '环形',
    styleNarrativeAttitude: '叙述态度',
    styleNarrativeObjective: '客观',
    styleNarrativeSympathetic: '同情',
    styleNarrativeCritical: '批判',
    styleNarrativeDetached: '疏离',
    styleRhythmSyllable: '音节模式',
    styleRhythmSyllableDense: '密集',
    styleRhythmSyllableBalanced: '平衡',
    styleRhythmSyllableSparse: '稀疏',
    styleRhythmSyllableFree: '自由',
    styleRhythmPause: '停顿模式',
    styleRhythmPauseFrequent: '频繁',
    styleRhythmPauseModerate: '适中',
    styleRhythmPauseMinimal: '极简',
    styleRhythmTempo: '速度',
    styleRhythmTempoFast: '快速',
    styleRhythmTempoModerate: '适中',
    styleRhythmTempoSlow: '缓慢',
    styleRhythmTempoVaried: '多变',
    styleTagAdd: '添加',
    styleTagPlaceholder: '输入后回车添加...',
    styleSignaturePhrases: '标志性短语',
    styleImagerySystem: '意象系统',
    styleAllusions: '典故',
    styleKnowledgeDomains: '知识领域',
    styleVocabularyPreferred: '偏好词汇',
    styleVocabularyAvoid: '避免词汇',
    styleUniqueness: '独特性',
    optimizerTwoStepMode: '两步分析模式',
    optimizerTwoStepAnalysis: '先分析AI特征，再基于诊断改写',

    // AI Text Optimizer
    optimizerTitle: 'AI 文本优化器',
    optimizerBadge: 'AI检测规避',
    optimizerPresetLabel: '优化模式',
    optimizerPresetHumanize: '人类写作特征优化',
    optimizerPresetHumanizeDesc: '去除AI特征，优化困惑度和突发性，使文本更自然',
    optimizerPresetAiGuide: 'AI修改指导',
    optimizerPresetAiGuideDesc: '分析AI痕迹并给出针对性修改建议和优化文本',
    optimizerPresetCharacter: '角色化叙事重构',
    optimizerPresetCharacterDesc: '以特定角色视角改写文本，消除AI模式化痕迹',
    optimizerPresetLiterary: '文学散文深度优化',
    optimizerPresetLiteraryDesc: '在保留艺术价值的前提下，进行深度文学性优化',
    optimizerPresetAcademic: '学术论文深度优化',
    optimizerPresetAcademicDesc: '基于CMU 2025框架优化TF-IDF、CST、VADER等指标',
    optimizerPresetCustom: '自定义指令',
    optimizerPresetCustomDesc: '使用自定义洗稿指令，满足个性化需求',
    optimizerCustomInstruction: '自定义指令',
    optimizerSourceLabel: '文本来源',
    optimizerSourceSelection: '编辑器选中文本',
    optimizerSourceSelectionHint: '已从当前编辑器选区载入，共 {count} 个字符',
    optimizerSourceManual: '手动输入',
    optimizerSourceManualHint: '当前内容已在这里手动输入或改写。',
    optimizerSourceEmpty: '暂无文本',
    optimizerSourceEmptyHint: '先在编辑器里选中文本，或直接把内容粘贴到这里再进行优化。',
    optimizerRefreshFromSelection: '从选区刷新',
    optimizerInputText: '待优化文本',
    optimizerInputPlaceholder: '粘贴需要优化的AI生成文本...',
    optimizerRun: '开始优化',
    optimizerRunning: '优化中...',
    optimizerFailed: '优化失败',
    optimizerResultTitle: '优化结果',
    optimizerDiagnosisTitle: 'AI特征诊断报告',
    optimizerDiagnosisHint: '点击展开',
    optimizerFeaturePerplexity: '困惑度优化',
    optimizerFeatureBurstiness: '突发性优化',
    optimizerFeatureDetection: '检测对抗',
    optimizerFeatureNatural: '自然语言',
    sidebarTextOptimizer: 'AI 文本优化',

    uiSettings: '界面设置',
    theme: '主题',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '跟随系统',
    themeSorbet: 'Sorbet',
    themeSlate: 'Slate',
    themeAmber: 'Amber',
    themeForest: 'Forest',
    themeCharcoal: 'Charcoal',
    themeCauldron: 'Cauldron',
    themeAurora: 'Aurora',
    themeMoonbeam: 'Moonbeam',
    themeSepia: 'Sepia',
    fontSize: '字体大小',
    fontSmall: '小',
    fontMedium: '中',
    fontLarge: '大',
    language: '语言',
    langChinese: '简体中文',
    langEnglish: 'English',
    sendShortcutLabel: '发送快捷键',
    sendShortcutEnter: 'Enter 发送',
    sendShortcutCtrlEnter: 'Ctrl/Cmd + Enter 发送',
    resetDefault: '重置默认',
    cancel: '取消',
    save: '保存',
    exportSettings: '导出设置',
    importSettings: '导入设置',
    importSuccess: '设置导入成功！',
    importFailed: '导入失败',

    // MCP Status Panel
    mcpPanelAriaLabel: '服务诊断面板',
    mcpPanelTitle: '连接详情',
    mcpRefresh: '刷新',
    mcpRefreshing: '刷新中...',
    mcpCloseAria: '关闭服务诊断面板',
    mcpFetchPartialError: '部分状态拉取失败，以下信息可能不完整。',
    mcpFetchFailed: '状态拉取失败，请稍后重试。',
    mcpProbeFailed: '探测失败',
    mcpUpdateFailed: '更新失败',
    mcpServiceIdRequired: '请先填写服务 ID',
    mcpCreateFailed: '创建失败',
    mcpGatewayStatus: '连接状态',
    mcpGatewayHealth: '连接情况',
    mcpSessionId: '会话 ID',
    mcpNotAvailable: '暂无',
    mcpReconnect: '恢复状态',
    mcpLastErrorPrefix: '最近错误：',
    mcpKeyServiceStatus: '关键服务状态',
    mcpServiceOnline: '在线',
    mcpServiceNotReady: '未就绪',
    mcpRuntimeMetrics: '运行指标',
    mcpRequestsTotal: '请求总数：{value}',
    mcpRequestsFailed: '失败请求：{value}',
    mcpLatencyAvg: '平均延迟：{value} ms',
    mcpLatencyMax: '最大延迟：{value} ms',
    mcpNoMetricsData: '暂无指标数据',
    mcpServiceDynamicConfig: '服务动态配置',
    mcpServiceIdPlaceholder: '服务 ID',
    mcpServiceNamePlaceholder: '服务名（可选）',
    mcpServicePathPlaceholder: '路径（可选）',
    mcpCreating: '创建中...',
    mcpCreateService: '新增服务',
    mcpServiceEnabled: '启用中',
    mcpServiceDisabled: '已禁用',
    mcpSaving: '保存中...',
    mcpSaveName: '保存名称',
    mcpDisable: '禁用',
    mcpEnable: '启用',
    mcpBuiltinServiceCannotToggle: '内置服务不可禁用',
    mcpProbing: '探测中...',
    mcpHealthCheck: '健康检测',
    mcpNoServiceConfigData: '暂无服务配置数据',
    mcpToolStats: '工具统计',
    mcpTotalTools: '总工具数',
    mcpNoToolData: '暂无工具数据',
    mcpStatusOk: '正常',
    mcpStatusError: '异常',
    mcpStatusDisabled: '已禁用',
    mcpStatusUnknown: '未知',
    mcpConnectionConnected: '已连接',
    mcpConnectionDegraded: '降级',
    mcpConnectionDisconnected: '已断开',
    mcpConnectionReconnecting: '重连中',
    mcpReconnectIdle: '空闲',
    mcpReconnectProbing: '探测中',
    mcpReconnectBackoff: '退避',
    mcpReconnectRetrying: '重试中',
    mcpReconnectRecovered: '已恢复',
    mcpReconnectFailed: '失败',
    mcpRuntimeDiagnostics: '运行诊断',
    mcpDiagnosticClass: '故障分类',
    runtimeUnavailableLabel: '运行时不可用',
    runtimeUnavailableMessage: '本地运行时当前不可用，请先启动或恢复网关服务。',
    packagedPrerequisiteMissingLabel: '缺少运行前置条件',
    packagedPrerequisiteMissingMessage: '当前环境缺少必要依赖，请先补齐运行前置条件后再重试。',
    embeddingAuthorityUnavailableLabel: 'Embedding 权威路径不可用',
    embeddingAuthorityUnavailableMessage: '当前检索依赖的 embedding 路径不可用，请恢复配置的 embedding 提供方或本地运行时。',
    parserMissingLabel: '文档解析器缺失',
    parserMissingMessage: '当前文档导入缺少解析依赖，请安装对应解析器后重试。',
    integrationDegradedLabel: '集成已降级',
    integrationDegradedMessage: '部分核心集成当前处于降级状态，请根据诊断信息修复后再继续。',

    // Settings Modal Diagnostics & Retrieval
    settingsDiagnostics: '连接帮助',
    settingsCheckConnection: '查看连接',
    settingsRefreshDiagnostics: '重新检查',
    settingsAdvancedSupport: '高级支持',
    settingsAdvancedSupportHint: '只在需要排查连接问题或修改本地服务配置时再展开。',
    settingsDetailedDiagnosticsHint: '需要查看连接状态、运行指标和更详细的信息时，再进入完整详情面板。',
    settingsOpenDetailedDiagnostics: '打开详细诊断',
    settingsGatewayMetrics: '网关指标',
    settingsToolList: '工具清单',
    settingsNoMetricsData: '暂无指标数据',
    settingsNoToolsData: '暂无工具数据',
    settingsAllowFallback: '允许降级',
    settingsDetectionGuard: '检测规避拦截',
    settingsRetrieval: '检索设置',
    settingsRetrievalProviderModel: '检索模型',
    settingsRetrievalSearchPlaceholder: '搜索模型名称或关键词',
    settingsEnableKnowledgeRetrieval: '为写作补充参考资料',
    settingsEnableRerank: '优先更贴近当前内容',
    settingsModelSource: '模型来源',
    settingsValidatingModel: '校验中...',
    settingsValidateDefaultModel: '校验默认模型',
    settingsRefreshModels: '刷新模型',
    settingsRefreshingModels: '刷新中...',
    settingsLastSync: '最近同步：{value}',
    settingsCustomModel: '自定义模型',
    settingsCustomModelPlaceholder: '例如：gpt-4.1-mini',
    settingsUseThisModel: '使用该模型',
    settingsInvalidConfigFile: '无效的配置文件格式',
    settingsImportFailedPrefix: '导入失败: ',
    settingsUnknownError: '未知错误',
    settingsSaveSuccess: '设置已保存。',
    settingsSavePartialFailure: '设置已保存，但这些阶段仍需处理：{stages}',
    settingsSaveFailed: '设置未完整保存，请先处理这些阶段：{stages}',
    settingsSaveStagePersisted: '设置持久化',
    settingsSaveStageRuntime: '运行时同步',
    settingsSaveStageValidation: '后端校验',
    settingsSaveValidationFailed: '后端校验未通过。',
    settingsModelNameRequired: '模型名称不能为空。',
    settingsModelNameTooLong: '模型名称过长（最多 120 个字符）。',
    settingsModelNameWhitespace: '模型名称不能包含空白字符。',
    settingsFetchModelsFailed: '模型拉取失败，请继续使用预置或自定义模型。',
    settingsFetchModelsFailedWithReason: '模型拉取失败（网关/直连均失败）：{error}',
    settingsInvalidCustomModel: '自定义模型不合法。',
    settingsPresetModels: '预置模型',
    settingsFetchedModels: '自动拉取',
    settingsCustomModels: '自定义模型',
    settingsDefaultModelValidateFetchFailed: '默认模型校验失败：无法拉取模型列表。',
    settingsDefaultModelAvailableViaGateway: '默认模型可用（来源：网关）。',
    settingsDefaultModelAvailableViaDirect: '默认模型可用（来源：直连）。',
    settingsDefaultModelUnavailable: '默认模型不在当前可用模型列表中。',
    settingsDefaultModelValidateFailed: '默认模型校验失败，请稍后重试。',
    settingsDiagnosticsFetchFailed: '诊断拉取失败，请稍后重试。',
    settingsApiKeyPlaceholder: 'sk-...',
    settingsSearchMode: '检索模式',
    settingsSearchModeHybrid: '混合检索',
    settingsSearchModeIterative: '迭代检索',
    settingsSearchModeContext: '上下文检索',
    settingsRetrievalProfile: '检索配置',
    settingsRetrievalProfilePlaceholder: 'balanced',
    settingsRetrievalMinScore: '最小分数',
    settingsRetrievalBudgetTokens: '检索预算',
    settingsRetrievalMaxIterations: '最大迭代次数',
    settingsRetrievalConfidenceThreshold: '置信阈值',
    settingsAgentContextTypes: '参考资料范围',
    settingsContextTypeWorld: '世界观',
    settingsContextTypeCharacter: '角色',
    settingsContextTypePlot: '剧情',
    quickPanelTitle: '快捷命令面板',
    quickPanelResultsLabel: '命令结果',
    quickPanelSearchPlaceholder: '搜索命令...',
    quickPanelNoMatch: '无匹配命令',
    quickPanelSelect: '↑↓ 选择',
    quickPanelConfirm: '↵ 确认',
    quickPanelClose: 'ESC 关闭',
    contentSearchPlaceholder: '搜索内容...',
    errorBoundaryTitle: '出了点问题',
    errorBoundaryDescription: '发生了意外错误。',
    errorBoundaryTryAgain: '重试',
    errorBoundaryReload: '重新加载',
    streamErrorCategory: '错误类别',
    scrollToBottom: '滚动到底部',
    sidebarNewDocument: '新建文档',
    sidebarContinueWriting: '继续写作',
    sidebarDocuments: '文档列表',
    mcpMetricTotal: '总请求',
    mcpMetricFailed: '失败',
    mcpMetricAvgLatency: '平均延迟',
    mcpMetricMaxLatency: '最大延迟',
    editorWordCount: '字数',
    editorCharCount: '字符',
    editorReadingTime: '约 {min} 分钟阅读',
    editorAutoSaved: '已保存',
    editorPlaceholder: '输入 / 唤出 AI 命令，或直接开始写作...',
    editorAiGenerating: 'AI 生成中...',
    editorAiCancel: '取消',
    editorCmdGenerate: 'AI 生成段落',
    editorCmdGenerateDesc: '根据上下文生成一段文本',
    editorCmdContinue: 'AI 续写',
    editorCmdContinueDesc: '从当前位置继续写作',
    editorCmdFullArticle: 'AI 生成文章',
    editorCmdFullArticleDesc: '生成一篇完整文章',
    editorCmdHeading1: '标题 1',
    editorCmdHeading1Desc: '大标题',
    editorCmdHeading2: '标题 2',
    editorCmdHeading2Desc: '中标题',
    editorCmdHeading3: '标题 3',
    editorCmdHeading3Desc: '小标题',
    editorCmdBulletList: '无序列表',
    editorCmdBulletListDesc: '创建无序列表',
    editorCmdOrderedList: '有序列表',
    editorCmdOrderedListDesc: '创建有序列表',
    editorCmdBlockquote: '引用',
    editorCmdBlockquoteDesc: '插入引用块',
    editorCmdCodeBlock: '代码块',
    editorCmdCodeBlockDesc: '插入代码块',
    editorCmdHorizontalRule: '分割线',
    editorCmdHorizontalRuleDesc: '插入水平分割线',
    editorBubbleBold: '加粗',
    editorBubbleItalic: '斜体',
    editorBubbleStrikethrough: '删除线',
    editorBubbleRewrite: 'AI 改写',
    editorBubblePolish: '润色',
    editorBubbleSimplify: '简化',
    editorBubbleExpand: '扩写',
    editorBubbleFormal: '正式化',
    editorBubbleCasual: '口语化',
    editorBubbleContinue: '续写',
    exportMarkdown: '导出 Markdown',
    exportHtml: '导出 HTML',

    // Sidebar writer workspace
    writerWorkspaceTitle: '当前写作项目',
    writerWorkspaceHint: '聊天、评估和知识整理会优先围绕这组上下文。',
    writerStoryBibleLabel: '打开故事设定',
    writerChapterLabel: '章节',
    writerStoryBibleMetaLabel: '设定稿',
    writerWorkspaceLabel: '工作区',

    // ChatArea starter actions
    starterContinueDesc: '保持当前语气和情节推进，继续往下写。',
    starterRewriteDesc: '把正在写的段落改得更流畅、更自然。',
    starterExpandDesc: '补足动作、环境和情绪细节。',
    starterAlignCanonDesc: '检查当前内容是否和现有设定冲突。',
    starterCheckIssuesDesc: '指出最值得先处理的问题和下一步。',
    starterContinuePrompt: '请基于{target}继续写作，保持当前语气、节奏和情节推进。',
    starterRewritePrompt: '请围绕{target}中我正在写的段落，给出更流畅、自然的改写版本。',
    starterExpandPrompt: '请围绕{target}扩写这个场景，补足动作、环境和情绪细节。',
    starterAlignCanonPrompt: '请检查{target}与现有故事设定是否一致，如有冲突请指出并给出修正建议。',
    starterCheckIssuesPrompt: '请审视{target}当前内容，指出最值得先处理的问题，并给出下一步建议。',
    writerContextTitle: '当前写作上下文',
    writerContextHint: '聊天、模板和评估会优先沿用这组项目范围。需要路由、对比或回滚时，展开"更多"。',
    currentDocumentFallback: '当前文档',
  },
  en: {
    // App
    appTitle: 'Novel Writing Assistant',
    serviceRunning: 'Ready to write',
    serviceOffline: 'Unavailable',
    contextUsage: 'Context',
    checkpoint: 'Checkpoint',
    restore: 'Restore',
    restoreSuccess: 'Restore successful',
    restoreSuccessWithCheckpoint: 'Restored to checkpoint {checkpointId}',
    restoreFailed: 'Restore failed',
    loadingCheckpoints: 'Loading checkpoints...',
    noCheckpoints: 'No checkpoints',
    contextEstimated: 'Estimated',

    // Sidebar
    nikoStudio: 'Niko-Studio',
    newChat: 'New Chat',
    chatList: 'Conversations',
    skillPacks: 'Skills',
    knowledgeBase: 'Story Notes',
    settings: 'Settings',
    skipToMainContent: 'Skip to main content',

    // Chat
    startWriting: 'Start Writing Your Story',
    startWritingDesc: 'Pick a writing action for the current document first, then continue the conversation if needed.',
    chatStarterHint: 'These actions stay anchored to your current document, chapter, and story context.',
    chatStarterContinue: 'Continue this draft',
    chatStarterRewrite: 'Rewrite this passage',
    chatStarterExpand: 'Expand this scene',
    chatStarterAlignCanon: 'Align with story canon',
    chatStarterCheckIssues: 'Check current issues',
    thinking: 'Niko is thinking...',
    workflow: 'Workflow',
    quick: 'Quick',
    lite: 'Lite',
    standard: 'Standard',
    brainstorm: 'Brainstorm',
    coordinator: 'Coordinator',
    planning: 'Planning',
    selectedSkills: '{count} skills selected',
    inputPlaceholder: 'Tell me what you want to create...',
    streamCanceled: 'Generation canceled.',
    streamInterrupted: 'Streaming generation was interrupted.',
    streamRecovered: 'Recovered from stream fallback; the result remains usable.',
    streamReconnecting: 'Connection recovering. Please wait...',
    streamRestoreHint: 'Send failed. You can restore to the state before sending.',
    streamRestoreToBeforeSend: 'Restore to before send',
    streamRetryLastSend: 'Retry send',
    streamCopyError: 'Copy error',
    streamErrorCopied: '(copied)',
    streamRestoreBeforeSendSuccess: 'Restored to the state before sending.',
    inlineNeedSelection: 'Please select text before revising.',
    inlineActionFailed: 'Inline AI action failed. Please try again.',
    inlineSelectedTextInfo: 'Selected text ({count} chars)',
    inlineContinue: 'Continue',
    inlineRevise: 'Revise',
    inlineGenerate: 'Generate',
    inlineRun: 'Run',
    inlineClearSelection: 'Clear Selection',
    inlineReviseDefaultInstruction: 'Please revise this text while preserving the original meaning.',
    inlineContinuePromptPrefix: 'Please continue writing based on the following content:',
    inlineGeneratePromptPrefix: 'Please generate new text based on the following content:',
    inlineGenerateContextFallback: 'Generate based on the current conversation context.',
    streamGateSoftGo: 'Executed with fallback (Soft Go): output is available, please keep monitoring.',
    streamGateNoGo: 'The current output did not pass the quality gate (No-Go). Please adjust and retry.',
    streamGovernanceRecovered: 'This result is recorded as recovered execution and remains usable with review.',
    streamGovernanceReviewReady: 'This reply includes consistency governance details in the message card.',
    templateLibraryEntry: 'Template Library',
    templateLibraryTitle: 'Template Library',
    templateClosePanel: 'Close template library',
    templateCategoryAll: 'All',
    templateCategoryBrainstorm: 'Brainstorm',
    templateCategoryOutline: 'Outline',
    templateCategoryCharacter: 'Character',
    templateCategoryRewrite: 'Rewrite',
    templateCategoryAnalysis: 'Analysis',
    templateCategoryCustom: 'Custom',
    templateFavorite: 'Favorite template',
    templateUnfavorite: 'Unfavorite template',
    templateFavoriteOnlyOn: 'Favorites only',
    templateFavoriteOnlyOff: 'All templates',
    templateSearchPlaceholder: 'Search template title or content',
    templateRequiredHint: 'This variable is required',
    templateApplyAction: 'Apply Template',
    templateApplyReplace: 'Replace Input',
    templateApplyAppend: 'Append Input',
    templateEmptyList: 'No templates yet',
    templateNoMatch: 'No matching templates',
    processingCompleted: 'Processing completed',
    serviceUnavailableRetry: 'Service is temporarily unavailable. Please retry later.',
    backendConnectionFailed: 'Backend connection failed. Please check settings.',
    sessionCreateFailedRetry: 'Failed to create session. Please retry.',
    uploadUnsupportedFormat: 'Unsupported file format. Please upload txt/md/pdf/docx.',
    uploadInjectionFailedRetry: 'File injection failed. Please retry.',
    uploadStageReading: 'Reading file...',
    uploadStageUploading: 'Uploading file...',
    uploadStageInjecting: 'Injecting context...',
    uploadErrorFormat: 'Unsupported file format.',
    uploadErrorSize: 'File is too large or exceeds the limit.',
    uploadErrorNetwork: 'Network error. Please check your connection.',
    uploadErrorPrerequisite: 'Missing document parser dependency or unsupported import path for this format.',
    uploadErrorService: 'Service failed to process the file. Please retry later.',
    uploadInjectedChunks: 'File context injected: {fileName} ({chunks} chunks)',
    uploadInjectedContext: 'Context injected from file: {fileName} ({chunks} chunks)',
    uploadMultipleProgress: 'Processing file {current}/{total}...',
    uploadMultipleComplete: 'Successfully uploaded {success}/{total} files',
    chatAgentContextPrefix: 'Agent context result',
    quickRollbackTitle: 'Quick Rollback',
    quickRollbackAdvancedToggle: 'Advanced: Quick Rollback',
    quickRollbackPlanIdPlaceholder: 'plan_id',
    quickRollbackCheckpointIdPlaceholder: 'checkpoint_id',
    quickRollbackReasonPlaceholder: 'Rollback reason (optional)',
    quickRollbackAction: 'Run rollback',
    quickRollbackSuccess: 'Quick rollback completed successfully.',
    quickRollbackFailed: 'Quick rollback failed.',
    quickRollbackMissingRequired: 'Please provide plan_id and checkpoint_id.',
    quickRollbackSummary: 'Most writing sessions never need this area. Open the advanced section only when you need to roll back by plan or checkpoint.',

    // Knowledge Modal
    knowledgeTitle: 'Story Notes',
    knowledgeClose: 'Close story notes',
    knowledgeTabCharacters: 'Characters',
    knowledgeTabLocations: 'Locations',
    knowledgeTabPlots: 'Plots',
    knowledgeTabSkills: 'Skills',
    knowledgeTaskLookup: 'Look Up',
    knowledgeTaskAugment: 'Add Material',
    knowledgeTaskReference: 'Use References',
    knowledgeTaskLookupHint: 'Check characters, locations, and plot references before deciding the next writing move.',
    knowledgeTaskAugmentHint: 'Add facts, foreshadows, and memory for the current project. Skill tools now live here as a secondary path.',
    knowledgeTaskReferenceHint: 'Lock in the references for this passage first so later AI actions stay anchored to the right material.',
    knowledgeTaskScopeTitle: 'Current writing scope',
    knowledgeTaskScopeEmpty: 'No project scope is bound yet, so the browser is showing general material.',
    knowledgeTaskBrowseTitle: 'Story categories',
    knowledgeTaskBrowseHint: 'Start with characters, locations, or plot threads to find what you want to inspect or cite.',
    knowledgeTaskAugmentMemory: 'Memory and clues',
    knowledgeTaskAugmentSkills: 'Skill support',
    knowledgeTaskSkillsHint: 'The skill library stays available here as a secondary helper instead of competing in the top navigation.',
    knowledgeSearchPlaceholder: 'Search...',
    knowledgeTaskMatch: 'Task Match',
    knowledgeSkillDetails: 'Skill Details',
    knowledgeSkillChain: 'Recommended Chain',
    knowledgeCurrentSkill: 'Current skill: {skillId}',
    knowledgeLoading: 'Loading...',
    knowledgeEmpty: 'No data',
    knowledgeAddPrefix: 'Add',
    knowledgeNoDescription: 'No description',
    knowledgeItemFallback: 'Item {index}',
    knowledgePromoteCanon: 'Promote to Canon',
    knowledgePromotingCanon: 'Promoting to canon…',
    knowledgePromoteCanonSuccess: 'Item promoted to canon.',
    knowledgePromoteCanonFailure: 'Failed to promote item to canon.',
    knowledgeSkillDetailsLoadFailed: 'Failed to load skill details',
    knowledgeTemporalTitle: 'Temporal Facts',
    knowledgeTemporalEntityPlaceholder: 'entity_id',
    knowledgeTemporalAtTimePlaceholder: 'at_time (optional, ISO time)',
    knowledgeTemporalAction: 'Query temporal facts',
    knowledgeTemporalEntityRequired: 'Please enter entity_id for temporal facts query.',
    knowledgeTemporalLoaded: 'Temporal facts loaded.',
    knowledgeCharacterTitle: 'Character Details',
    knowledgeCharacterNamePlaceholder: 'Character name',
    knowledgeCharacterAction: 'Load character details',
    knowledgeCharacterNameRequired: 'Please enter character name.',
    knowledgeCharacterLoaded: 'Character details loaded.',
    knowledgeForeshadowTitle: 'Foreshadow Filters',
    knowledgeForeshadowStatusPlaceholder: 'status',
    knowledgeForeshadowStatusPending: 'pending',
    knowledgeForeshadowStatusResolved: 'resolved',
    knowledgeForeshadowStatusAll: 'all',
    knowledgeForeshadowChapterPlaceholder: 'chapter',
    knowledgeForeshadowAction: 'Query foreshadows',
    knowledgeForeshadowsLoaded: 'Foreshadows loaded.',
    knowledgeMemoryTitle: 'Add Memory',
    knowledgeMemoryContentPlaceholder: 'Memory content',
    knowledgeMemoryLayerPlaceholder: 'layer',
    knowledgeMemoryDimensionPlaceholder: 'dimension',
    knowledgeMemoryEntityPlaceholder: 'entity_id (optional)',
    knowledgeMemoryTagsPlaceholder: 'tags (comma separated)',
    knowledgeMemoryAction: 'Add memory',
    knowledgeMemoryContentRequired: 'Please enter memory content.',
    knowledgeMemoryAdded: 'Memory added successfully.',
    knowledgeRequestFailed: 'Request failed. Please try again.',

    // Evaluation Panel
    evaluationTitle: 'Reply Review',
    evaluationClose: 'Close evaluation panel',
    evaluationFailed: 'Evaluation failed',
    failureCategoryGeneration: 'Generation failed',
    failureCategoryEvaluation: 'Evaluation failed',
    failureCategoryRetrieval: 'Reference lookup failed',
    failureCategoryConnection: 'Connection failed',
    failureMessageGeneration: 'This reply did not finish generating. You can retry or keep writing.',
    failureMessageEvaluation: 'The evaluation step is temporarily unavailable. You can keep writing and retry later.',
    failureMessageRetrieval: 'The assistant could not fetch supporting references this time. Retry later or continue with the current draft.',
    failureMessageConnection: 'The app could not reach the local service. Check the service status and try again.',
    evaluationNoContent: 'No assistant reply to review yet',
    evaluationOverallScore: 'Overall Score',
    evaluationDimensionAnalysis: 'Dimension Analysis',
    evaluationSuggestions: 'Suggestions',
    evaluationBatchApply: 'Batch Apply',
    evaluationBatchUndo: 'Batch Undo',
    evaluationApply: 'Apply',
    evaluationUndo: 'Undo',
    evaluationApplying: 'Applying...',
    evaluationUndoing: 'Undoing...',
    evaluationBatchApplying: 'Batch applying...',
    evaluationBatchUndoing: 'Batch undoing...',
    evaluationBatchResult: 'Batch result: success {applied}, failed {failed}',
    evaluationBatchUndoResult: 'Batch undo result: success {success}, failed {failed}',
    evaluationPassed: 'Passed',
    evaluationNeedRevise: 'Needs revision',
    evaluationNeedRewrite: 'Needs rewrite',
    evaluationUnknown: 'Unknown',
    evaluationNoFeedback: 'None',
    evaluationDimensionLock: 'Lock',
    evaluationDimensionStyle: 'Style',
    evaluationDimensionLogic: 'Logic',
    evaluationActionFailedWithReason: '{action} failed: {reason}',
    evaluationRecommendationFallback: 'Recommendation {index}',
    evaluationCheckpointTitle: 'Checkpoint',
    evaluationCheckpointPlaceholder: 'Checkpoint description',
    evaluationRefresh: 'Refresh',
    evaluationSuggestionsRefresh: 'Refresh suggestions',
    evaluationSuggestionsRefreshing: 'Refreshing suggestions...',
    evaluationSuggestionsRefreshFailed: 'Failed to refresh suggestions. Please try again later.',
    evaluationQualityCheckTitle: 'Novel Quality Check',
    evaluationQualityCheckRun: 'Run quality check',
    evaluationQualityCheckRunning: 'Running quality check...',
    evaluationQualityCheckFailed: 'Quality check failed',
    evaluationQualityCheckDecision: 'Decision',
    evaluationQualityCheckTotal: 'Total',
    evaluationQualityCheckLock: 'Lock',
    evaluationQualityCheckStyle: 'Style',
    evaluationQualityCheckLogic: 'Logic',
    evaluationQualityCheckFeedback: 'Feedback',
    evaluationConsistencyTitle: 'Consistency governance',
    evaluationConsistencyRun: 'Run consistency check',
    evaluationConsistencyRunning: 'Running consistency check...',
    evaluationConsistencyFailed: 'Consistency check failed',
    evaluationConsistencySummary: 'Summary',
    evaluationConsistencyScore: 'Overall score',
    evaluationConsistencyConflicts: 'Conflicts',
    evaluationConsistencyRunId: 'Run ID',
    evaluationWorkflowTitle: 'Advanced Workflow',
    evaluationWorkflowTaskPlaceholder: 'workflow task',
    evaluationWorkflowLevelPlaceholder: 'workflow level (e.g. L3)',
    evaluationWorkflowPlanIdPlaceholder: 'plan_id',
    evaluationWorkflowStepIdPlaceholder: 'step_id (optional)',
    evaluationWorkflowLifecycleActionLabel: 'lifecycle action',
    evaluationWorkflowLifecycleStatus: 'status',
    evaluationWorkflowLifecycleStart: 'start',
    evaluationWorkflowLifecyclePause: 'pause',
    evaluationWorkflowLifecycleResume: 'resume',
    evaluationWorkflowLifecycleStop: 'stop',
    evaluationWorkflowRoute: 'route',
    evaluationWorkflowPlan: 'plan',
    evaluationWorkflowExecute: 'execute',
    evaluationWorkflowLifecycle: 'lifecycle',
    evaluationWorkflowRetry: 'Retry',
    evaluationWorkflowLoading: 'Requesting...',
    evaluationWorkflowSuccess: 'Success',
    evaluationWorkflowError: 'Failed',
    evaluationWorkflowPlanIdRequired: 'Please provide plan_id first.',
    evaluationWorkflowWaitingConfirmation: 'Waiting for confirmation to continue.',
    evaluationWorkflowGateReason: 'Gate reason',
    evaluationWorkflowConfirmTokenPlaceholder: 'confirm_token',
    evaluationWorkflowConfirmAndContinue: 'Confirm & Continue',
    evaluationWorkflowConfirmTokenRequired: 'Please provide confirm_token first.',

    // Chat Area Controls
    chatModeLabel: 'Mode:',
    chatModeNormal: 'Normal Chat',
    chatModeAgent: 'Agent Advanced',
    chatModeComparison: 'Model Comparison',
    modePresetsLabel: 'Presets:',
    modePresetFocusWriting: 'Focus Writing',
    modePresetAgentDiagnose: 'Agent Diagnose',
    modePresetCompareReview: 'Dual-Model Review',
    showMore: 'More',
    showLess: 'Less',
    chatComparisonModelLabel: 'Control Model',
    messageBubblePrimaryModelLabel: 'Primary Model: ',
    messageBubbleControlModelLabel: 'Control Model: ',
    messageBubbleDiffHighlightsLabel: 'Diff highlights',
    messageBubbleAcceptPrimary: 'Accept primary',
    messageBubbleAcceptControl: 'Accept control',
    messageBubbleSourceSummaryTitle: 'References used',
    messageBubbleSourceSummaryUsed: 'This reply drew on {summary}.',
    messageBubbleSourceSummaryFallback: 'This reply stayed within the current conversation and did not expand into extra references.',
    messageBubbleSourcePrimary: 'Primary reference',
    messageBubbleSourceTypeCanon: 'project canon',
    messageBubbleSourceTypeEntity: 'characters and key elements',
    messageBubbleSourceTypeRelation: 'story links',
    messageBubbleSourceTypeMemory: 'project memory',
    messageBubbleRetrievalStatus: 'Retrieval: Entities {entities} / Relations {relations} / Memories {memories}',
    messageBubbleCanonContextTitle: 'Canon Context',
    messageBubbleCanonContextApplied: 'This reply used {matches} canon matches from {pages} indexed pages.',
    messageBubbleCanonContextUnavailable: 'The app could not expand into project references this time: {reason}',
    messageBubblePromoteCanon: 'Promote Reply to Canon',
    messageBubblePromotingCanon: 'Promoting to canon…',
    messageBubblePromoteCanonSuccess: 'Reply promoted to canon.',
    messageBubblePromoteCanonFailure: 'Failed to promote reply to canon.',
    chatAgentActionWrite: 'Write',
    chatAgentActionRevise: 'Polish/Rewrite',
    chatAgentActionContext: 'Get Context',
    composerUpload: 'Upload file',
    composerVoiceInput: 'Voice input',
    voiceInputStatusLabel: 'Coming soon',
    composerSend: 'Send',

    // Sidebar
    sidebarToggleExpand: 'Expand sidebar',
    sidebarToggleCollapse: 'Collapse sidebar',
    chatSidebarToggleExpand: 'Expand chat panel',
    chatSidebarToggleCollapse: 'Collapse chat panel',
    storyBibleTitle: 'Story Bible',
    storyBibleDesc: 'Track the key details of your story\'s world to improve AI suggestions, or fill it step-by-step to grow your idea into a first draft.',
    storyBibleBraindump: 'Braindump',
    storyBibleBraindumpHint: 'Write down everything you know about the story — plot, characters, worldbuilding, themes, anything!',
    storyBibleGenre: 'Genre',
    storyBibleGenrePlaceholder: 'Enter genres, e.g.: Fantasy, Romance, Mystery...',
    storyBibleSynopsis: 'Synopsis',
    storyBibleSynopsisPlaceholder: 'Introduce the characters, their goals, and the central conflict, while conveying the story\'s tone and unique elements...',
    storyBibleCharacters: 'Characters',
    storyBibleWorldbuilding: 'Worldbuilding',
    storyBibleOutline: 'Novel Outline',
    storyBibleStyleTitle: 'Writing Style',
    storyBibleStyleTried: 'Tried and True',
    storyBibleStyleTriedDesc: 'Proven writing styles',
    storyBibleStyleMatchMy: 'Match My Style',
    storyBibleStyleMatchMyDesc: 'Analyze your writing style',
    storyBibleStyleSoundsLike: 'Sounds Like You',
    storyBibleStyleSoundsLikeDesc: 'Mimic a specific author\'s style',
    storyBibleStyleCustom: 'Custom',
    storyBibleStyleCustomDesc: 'Full control over your style',
    storyBibleGenerate: 'Generate',
    storyBibleEmpty: 'No items yet',
    storyBibleLoading: 'Loading...',
    storyBiblePersistenceTitle: 'Current persistence boundary',
    storyBiblePersistenceLocalOnly: 'Local-only draft fields: braindump, genres, synopsis, outline, and style are stored only in this device/browser localStorage.',
    storyBiblePersistenceGraphRead: 'Graph-backed read lists: characters and locations come from graph queries and are not part of the local draft payload.',
    storyBibleExportDraft: 'Export local draft',
    storyBibleImportDraft: 'Import local draft',
    storyBibleResetDraft: 'Reset local draft',
    storyBibleDraftExported: 'Story Bible local draft exported.',
    storyBibleDraftImported: 'Story Bible local draft imported.',
    storyBibleDraftReset: 'Story Bible local draft reset.',
    storyBibleDraftImportInvalid: 'Invalid Story Bible draft file.',
    aiToolWrite: 'Write',
    aiToolRewrite: 'Rewrite',
    aiToolDescribe: 'Describe',
    aiToolBrainstorm: 'Brainstorm',
    sidebarWritingHelper: 'Writing Helper',
    sidebarMcpStatus: 'Service Diagnostics',
    sidebarEvaluationPanel: 'Reply Review',
    skillGroupCore: 'Core',
    skillGroupStory: 'Story',
    skillGroupQuality: 'Quality',
    skillGroupTools: 'Tools',
    skillGroupEmpty: 'No skills',
    skillDescriptionGeneric: 'Click to apply in current chat',
    skillDescCharacterForge: 'Character Forge',
    skillDescSuspenseCraft: 'Suspense Craft',
    skillDescDialogueSystem: 'Dialogue System',
    skillDescTensionArc: 'Tension Arc',
    skillDescEmotionArc: 'Emotion Arc',
    skillDescOpeningCraft: 'Opening Craft',
    skillDescEndingCraft: 'Ending Craft',
    skillDescConflictEscalation: 'Conflict Escalation',

    // App status
    serviceDegraded: 'Some actions may need retry',
    serviceReconnecting: 'Restoring connection',
    contextUsageLowHint: 'Context budget is healthy',
    contextUsageMediumHint: 'Context usage is rising. Consider shorter prompts',
    contextUsageHighHint: 'Context is near limit. Consider starting a new chat',

    // Writing Helper panel
    writingHelperTitle: 'Writing Helper',
    writingHelperMode: 'Mode',
    writingHelperModePolish: 'Polish',
    writingHelperModeRewrite: 'Rewrite',
    writingHelperModeExpand: 'Expand',
    writingHelperModeSummarize: 'Summarize',
    writingHelperModeOutline: 'Outline',
    writingHelperMaxSentences: 'Max Sentences (Summary)',
    writingHelperMaxItems: 'Max Items (Outline)',
    writingHelperInputText: 'Input Text',
    writingHelperInputPlaceholder: 'Enter text to process',

    // Settings modal
    settingsClose: 'Close settings',

    // Settings
    settingsTitle: 'Settings',
    backendService: 'Connection & local service',
    backendUrl: 'Local service address',
    backendConfigTitle: 'Local service settings',
    backendConfigDescription: 'View and edit runtime backend configuration. Read-only fields still require file changes or a service restart.',
    backendConfigLoading: 'Loading configuration...',
    backendConfigSyncing: 'Syncing...',
    backendConfigSyncSuccess: 'Sync successful',
    backendConfigReload: 'Reload from file',
    backendConfigSave: 'Save changes',
    backendConfigSaveSecrets: 'Save secrets',
    backendConfigReadOnly: 'Read only',
    backendConfigReadOnlyHint: 'This field requires a config file change or service restart to take effect',
    backendConfigSecretsTitle: 'Sensitive Fields',
    backendConfigSecretsDescription: 'Sensitive fields are saved separately through the secrets endpoint.',
    backendConfigShowSecret: 'Show',
    backendConfigHideSecret: 'Hide',
    backendConfigConfigured: 'Configured',
    backendConfigNotConfigured: 'Not configured',
    backendConfigNoConfig: 'No backend configuration data available.',
    backendConfigNoSecrets: 'There are currently no editable sensitive fields.',
    backendConfigSectionAgent: 'Agent',
    backendConfigSectionMemory: 'Memory',
    backendConfigSectionWorkflow: 'Workflow',
    backendConfigSectionGraph: 'Graph',
    backendConfigSectionWriting: 'Writing',
    backendConfigSectionGateway: 'Gateway',
    backendConfigSectionBackup: 'Backup',
    backendConfigSectionToken: 'Token',
    backendConfigSectionObsidian: 'Obsidian',
    backendConfigSectionIntegration: 'Integration',
    llmConfig: 'LLM Configuration',
    multiModel: 'Multi-Model Parallel',
    primary: 'Primary',
    testConnection: 'Test Connection',
    testing: 'Testing...',
    apiKey: 'API Key',
    baseUrl: 'Base URL',
    defaultModel: 'Default Model',
    setPrimary: 'Set as Primary Provider',
    modelParams: 'Model Parameters',
    temperature: 'Temperature (Creativity)',
    temperatureDesc: 'Lower (0-0.3): More deterministic, for factual writing | Higher (0.7-1): More creative, for creative writing',
    writingSettings: 'Writing Settings',
    defaultWorkflow: 'Default Workflow',
    workflowBackendMode: 'Workflow Backend Mode',
    workflowBackendModeStandard: 'Standard (/workflow/*)',
    workflowBackendModeUiBridge: 'UI Bridge (/ui-bridge/workflow/*)',
    workflowL1: 'L1 - Quick (Polish/Q&A)',
    workflowL2: 'L2 - Lite (Short Drafts)',
    workflowL3: 'L3 - Standard (Chapter Writing)',
    workflowL4: 'L4 - Brainstorm (Multi-angle Ideation)',
    workflowL5: 'L5 - Coordinator (Book Design)',
    targetWords: 'Target Words per Chapter',
    autoSkillMatch: 'Auto Match Skills',
    qualityGoalsTitle: 'Quality Enhancement Goals',
    qualityGoalNaturalness: 'Naturalness',
    qualityGoalReadability: 'Readability',
    qualityGoalCoherence: 'Coherence',
    qualityGoalStyleConsistency: 'Style Consistency',
    qualityGoalPreset: 'Optimization Preset',
    qualityPresetHumanWriting: 'Human Writing Traits',
    qualityPresetAiEditGuidance: 'AI Editing Guidance',
    qualityPresetCustom: 'Custom',
    qualityGoalSentenceEntropy: 'Sentence Entropy Target',
    qualityGoalRhythmVariability: 'Rhythm Variability Target',
    qualityGoalCustomInstruction: 'Custom Optimization Instruction',
    qualityGoalCustomInstructionPlaceholder: 'Enter your personalized rewrite/polish instruction',
    writingHelperLegacyPolish: 'Use legacy interface for Writing Helper polish',
    writingHelperClose: 'Close',
    writingHelperGuardStatus: 'Detection evasion guard: {status}',
    writingHelperGuardOn: 'On',
    writingHelperGuardOff: 'Off',
    writingHelperHint: 'You can change the detection evasion guard in Settings → LLM Configuration.',
    writingHelperOpenSettings: 'Open Settings',
    writingHelperModePrefix: 'Mode: {mode}',
    writingHelperRun: 'Run',
    writingHelperRunning: 'Processing...',
    writingHelperClearDraft: 'Clear Draft',
    writingHelperFailed: 'Processing failed',
    writingHelperInsertToEditor: 'Insert to Editor',

    // Style Settings
    styleSettingsTitle: 'Style Settings',
    styleTone: 'Tone',
    styleToneWarm: 'Warm',
    styleToneFormal: 'Formal',
    styleToneCasual: 'Casual',
    styleToneHumorous: 'Humorous',
    styleToneSerious: 'Serious',
    styleToneMelancholic: 'Melancholic',
    styleFormality: 'Formality',
    styleEmotion: 'Emotion',
    styleCreativity: 'Creativity',
    stylePerspective: 'Perspective',
    stylePerspectiveFirst: '1st Person',
    stylePerspectiveThird: '3rd Person',
    stylePerspectiveSecond: '2nd Person',
    stylePerspectiveOmniscient: 'Omniscient',
    styleSentence: 'Sentence Style',
    styleSentenceConcise: 'Concise',
    styleSentenceFlowing: 'Flowing',
    styleSentenceVaried: 'Varied',
    styleSentenceComplex: 'Complex',
    styleRhythmLabel: 'Rhythm',
    styleRhythmBrisk: 'Brisk',
    styleRhythmModerate: 'Moderate',
    styleRhythmLeisurely: 'Leisurely',
    styleNarrativeDistance: 'Narrative Distance',

    // Style sub-property labels
    styleAdvancedTitle: 'Advanced Style Settings',
    styleStructure: 'Structure',
    styleParagraphLength: 'Paragraph Length',
    styleParagraphShort: 'Short',
    styleParagraphMedium: 'Medium',
    styleParagraphLong: 'Long',
    styleParagraphVaried: 'Varied',
    styleTransition: 'Transition',
    styleTransitionSmooth: 'Smooth',
    styleTransitionDirect: 'Direct',
    styleTransitionDramatic: 'Dramatic',
    styleTransitionSubtle: 'Subtle',
    styleHierarchy: 'Hierarchy',
    styleHierarchyFlat: 'Flat',
    styleHierarchyNested: 'Nested',
    styleHierarchyParallel: 'Parallel',
    styleHierarchyProgressive: 'Progressive',
    styleEmotionExpression: 'Expression',
    styleEmotionImplicit: 'Implicit',
    styleEmotionExplicit: 'Explicit',
    styleEmotionRestrained: 'Restrained',
    styleEmotionPassionate: 'Passionate',
    styleThinkingLogic: 'Logic Pattern',
    styleThinkingDeductive: 'Deductive',
    styleThinkingInductive: 'Inductive',
    styleThinkingAnalogical: 'Analogical',
    styleThinkingDialectical: 'Dialectical',
    styleThinkingDepth: 'Thinking Depth',
    styleThinkingRhythm: 'Thinking Rhythm',
    styleThinkingMethodical: 'Methodical',
    styleThinkingExploratory: 'Exploratory',
    styleThinkingRapid: 'Rapid',
    styleThinkingContemplative: 'Contemplative',
    styleNarrativeTime: 'Time Sequence',
    styleNarrativeTimeLinear: 'Linear',
    styleNarrativeTimeFlashback: 'Flashback',
    styleNarrativeTimeInterleaved: 'Interleaved',
    styleNarrativeTimeCircular: 'Circular',
    styleNarrativeAttitude: 'Narrator Attitude',
    styleNarrativeObjective: 'Objective',
    styleNarrativeSympathetic: 'Sympathetic',
    styleNarrativeCritical: 'Critical',
    styleNarrativeDetached: 'Detached',
    styleRhythmSyllable: 'Syllable Pattern',
    styleRhythmSyllableDense: 'Dense',
    styleRhythmSyllableBalanced: 'Balanced',
    styleRhythmSyllableSparse: 'Sparse',
    styleRhythmSyllableFree: 'Free',
    styleRhythmPause: 'Pause Pattern',
    styleRhythmPauseFrequent: 'Frequent',
    styleRhythmPauseModerate: 'Moderate',
    styleRhythmPauseMinimal: 'Minimal',
    styleRhythmTempo: 'Tempo',
    styleRhythmTempoFast: 'Fast',
    styleRhythmTempoModerate: 'Moderate',
    styleRhythmTempoSlow: 'Slow',
    styleRhythmTempoVaried: 'Varied',
    styleTagAdd: 'Add',
    styleTagPlaceholder: 'Type and press Enter...',
    styleSignaturePhrases: 'Signature Phrases',
    styleImagerySystem: 'Imagery System',
    styleAllusions: 'Allusions',
    styleKnowledgeDomains: 'Knowledge Domains',
    styleVocabularyPreferred: 'Preferred Words',
    styleVocabularyAvoid: 'Avoid Words',
    styleUniqueness: 'Uniqueness',
    optimizerTwoStepMode: 'Two-Step Analysis',
    optimizerTwoStepAnalysis: 'Analyze AI traits first, then rewrite based on diagnosis',

    // AI Text Optimizer
    optimizerTitle: 'AI Text Optimizer',
    optimizerBadge: 'Detection Evasion',
    optimizerPresetLabel: 'Optimization Mode',
    optimizerPresetHumanize: 'Humanize',
    optimizerPresetHumanizeDesc: 'Remove AI traits, optimize perplexity & burstiness for natural text',
    optimizerPresetAiGuide: 'AI Modification Guide',
    optimizerPresetAiGuideDesc: 'Analyze AI traces and provide targeted modification suggestions',
    optimizerPresetCharacter: 'Character Narrative',
    optimizerPresetCharacterDesc: 'Rewrite from a specific character perspective to eliminate AI patterns',
    optimizerPresetLiterary: 'Literary Polish',
    optimizerPresetLiteraryDesc: 'Deep literary optimization while preserving artistic value',
    optimizerPresetAcademic: 'Academic Paper',
    optimizerPresetAcademicDesc: 'Optimize TF-IDF, CST, VADER metrics based on CMU 2025 framework',
    optimizerPresetCustom: 'Custom',
    optimizerPresetCustomDesc: 'Use custom rewriting instructions for personalized results',
    optimizerCustomInstruction: 'Custom Instruction',
    optimizerSourceLabel: 'Text source',
    optimizerSourceSelection: 'Editor selection',
    optimizerSourceSelectionHint: 'Loaded from the current editor selection, {count} characters',
    optimizerSourceManual: 'Manual input',
    optimizerSourceManualHint: 'The current text was entered or revised here.',
    optimizerSourceEmpty: 'No text yet',
    optimizerSourceEmptyHint: 'Select text in the editor or paste text here before running the optimizer.',
    optimizerRefreshFromSelection: 'Refresh from selection',
    optimizerInputText: 'Text to Optimize',
    optimizerInputPlaceholder: 'Paste AI-generated text to optimize...',
    optimizerRun: 'Optimize',
    optimizerRunning: 'Optimizing...',
    optimizerFailed: 'Optimization failed',
    optimizerResultTitle: 'Optimized Result',
    optimizerDiagnosisTitle: 'AI Characteristic Diagnosis Report',
    optimizerDiagnosisHint: 'Click to expand',
    optimizerFeaturePerplexity: 'Perplexity',
    optimizerFeatureBurstiness: 'Burstiness',
    optimizerFeatureDetection: 'Anti-Detection',
    optimizerFeatureNatural: 'Natural Language',
    sidebarTextOptimizer: 'Text Optimizer',

    uiSettings: 'UI Settings',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    themeSorbet: 'Sorbet',
    themeSlate: 'Slate',
    themeAmber: 'Amber',
    themeForest: 'Forest',
    themeCharcoal: 'Charcoal',
    themeCauldron: 'Cauldron',
    themeAurora: 'Aurora',
    themeMoonbeam: 'Moonbeam',
    themeSepia: 'Sepia',
    fontSize: 'Font Size',
    fontSmall: 'Small',
    fontMedium: 'Medium',
    fontLarge: 'Large',
    language: 'Language',
    langChinese: '简体中文',
    langEnglish: 'English',
    sendShortcutLabel: 'Send shortcut',
    sendShortcutEnter: 'Enter to send',
    sendShortcutCtrlEnter: 'Ctrl/Cmd + Enter to send',
    resetDefault: 'Reset Default',
    cancel: 'Cancel',
    save: 'Save',
    exportSettings: 'Export Settings',
    importSettings: 'Import Settings',
    importSuccess: 'Settings imported successfully!',
    importFailed: 'Import failed',

    // MCP Status Panel
    mcpPanelAriaLabel: 'Service diagnostics panel',
    mcpPanelTitle: 'Connection details',
    mcpRefresh: 'Refresh',
    mcpRefreshing: 'Refreshing...',
    mcpCloseAria: 'Close service diagnostics panel',
    mcpFetchPartialError: 'Some status data failed to load. Information below may be incomplete.',
    mcpFetchFailed: 'Failed to load status. Please try again later.',
    mcpProbeFailed: 'Probe failed',
    mcpUpdateFailed: 'Update failed',
    mcpServiceIdRequired: 'Please provide a service ID first',
    mcpCreateFailed: 'Create failed',
    mcpGatewayStatus: 'Connection status',
    mcpGatewayHealth: 'Connection',
    mcpSessionId: 'Session ID',
    mcpNotAvailable: 'N/A',
    mcpReconnect: 'Recovery',
    mcpLastErrorPrefix: 'Last error: ',
    mcpKeyServiceStatus: 'Key service status',
    mcpServiceOnline: 'Online',
    mcpServiceNotReady: 'Not ready',
    mcpRuntimeMetrics: 'Runtime metrics',
    mcpRequestsTotal: 'Total requests: {value}',
    mcpRequestsFailed: 'Failed requests: {value}',
    mcpLatencyAvg: 'Average latency: {value} ms',
    mcpLatencyMax: 'Max latency: {value} ms',
    mcpNoMetricsData: 'No metrics data',
    mcpServiceDynamicConfig: 'Dynamic service config',
    mcpServiceIdPlaceholder: 'Service ID',
    mcpServiceNamePlaceholder: 'Service name (optional)',
    mcpServicePathPlaceholder: 'Path (optional)',
    mcpCreating: 'Creating...',
    mcpCreateService: 'Add service',
    mcpServiceEnabled: 'Enabled',
    mcpServiceDisabled: 'Disabled',
    mcpSaving: 'Saving...',
    mcpSaveName: 'Save name',
    mcpDisable: 'Disable',
    mcpEnable: 'Enable',
    mcpBuiltinServiceCannotToggle: 'Built-in services cannot be disabled',
    mcpProbing: 'Probing...',
    mcpHealthCheck: 'Health check',
    mcpNoServiceConfigData: 'No service config data',
    mcpToolStats: 'Tool stats',
    mcpTotalTools: 'Total tools',
    mcpNoToolData: 'No tool data',
    mcpStatusOk: 'OK',
    mcpStatusError: 'Error',
    mcpStatusDisabled: 'Disabled',
    mcpStatusUnknown: 'Unknown',
    mcpConnectionConnected: 'Connected',
    mcpConnectionDegraded: 'Degraded',
    mcpConnectionDisconnected: 'Disconnected',
    mcpConnectionReconnecting: 'Reconnecting',
    mcpReconnectIdle: 'Idle',
    mcpReconnectProbing: 'Probing',
    mcpReconnectBackoff: 'Backoff',
    mcpReconnectRetrying: 'Retrying',
    mcpReconnectRecovered: 'Recovered',
    mcpReconnectFailed: 'Failed',
    mcpRuntimeDiagnostics: 'Runtime diagnostics',
    mcpDiagnosticClass: 'Failure class',
    runtimeUnavailableLabel: 'Runtime unavailable',
    runtimeUnavailableMessage: 'The local runtime is unavailable. Start or restore the gateway service before retrying.',
    packagedPrerequisiteMissingLabel: 'Missing runtime prerequisite',
    packagedPrerequisiteMissingMessage: 'This environment is missing a required dependency. Install the prerequisite and retry.',
    embeddingAuthorityUnavailableLabel: 'Embedding authority unavailable',
    embeddingAuthorityUnavailableMessage: 'The authoritative embedding path is unavailable. Restore the configured embedding provider or local runtime before using retrieval flows.',
    parserMissingLabel: 'Document parser missing',
    parserMissingMessage: 'Document import is missing a parser dependency. Install the required parser and retry.',
    integrationDegradedLabel: 'Integration degraded',
    integrationDegradedMessage: 'One or more core integrations are degraded. Fix the affected services before continuing.',

    // Settings Modal Diagnostics & Retrieval
    settingsDiagnostics: 'Connection help',
    settingsCheckConnection: 'Check connection',
    settingsRefreshDiagnostics: 'Check again',
    settingsAdvancedSupport: 'Advanced support',
    settingsAdvancedSupportHint: 'Expand this only when you need connection troubleshooting or local service configuration.',
    settingsDetailedDiagnosticsHint: 'Open the full details panel only when you need connection status, runtime metrics, or deeper support details.',
    settingsOpenDetailedDiagnostics: 'Open detailed diagnostics',
    settingsGatewayMetrics: 'Gateway metrics',
    settingsToolList: 'Tool list',
    settingsNoMetricsData: 'No metrics data',
    settingsNoToolsData: 'No tool data',
    settingsAllowFallback: 'Allow fallback',
    settingsDetectionGuard: 'Detection-evasion guard',
    settingsRetrieval: 'Retrieval settings',
    settingsRetrievalProviderModel: 'Retrieval model',
    settingsRetrievalSearchPlaceholder: 'Search model name or keyword',
    settingsEnableKnowledgeRetrieval: 'Use supporting references',
    settingsEnableRerank: 'Prioritize closer matches',
    settingsModelSource: 'Model source',
    settingsValidatingModel: 'Validating...',
    settingsValidateDefaultModel: 'Validate default model',
    settingsRefreshModels: 'Refresh models',
    settingsRefreshingModels: 'Refreshing...',
    settingsLastSync: 'Last sync: {value}',
    settingsCustomModel: 'Custom model',
    settingsCustomModelPlaceholder: 'Example: gpt-4.1-mini',
    settingsUseThisModel: 'Use this model',
    settingsInvalidConfigFile: 'Invalid config file format',
    settingsImportFailedPrefix: 'Import failed: ',
    settingsUnknownError: 'Unknown error',
    settingsSaveSuccess: 'Settings saved.',
    settingsSavePartialFailure: 'Settings were saved, but these stages still need attention: {stages}',
    settingsSaveFailed: 'Settings did not save cleanly. Resolve these stages first: {stages}',
    settingsSaveStagePersisted: 'settings persistence',
    settingsSaveStageRuntime: 'runtime sync',
    settingsSaveStageValidation: 'backend validation',
    settingsSaveValidationFailed: 'Backend validation did not pass.',
    settingsModelNameRequired: 'Model name cannot be empty.',
    settingsModelNameTooLong: 'Model name is too long (max 120 characters).',
    settingsModelNameWhitespace: 'Model name cannot contain whitespace.',
    settingsFetchModelsFailed: 'Failed to fetch models. Please continue with preset or custom models.',
    settingsFetchModelsFailedWithReason: 'Failed to fetch models (gateway/direct both failed): {error}',
    settingsInvalidCustomModel: 'Invalid custom model.',
    settingsPresetModels: 'Preset models',
    settingsFetchedModels: 'Fetched models',
    settingsCustomModels: 'Custom models',
    settingsDefaultModelValidateFetchFailed: 'Default model validation failed: could not fetch model list.',
    settingsDefaultModelAvailableViaGateway: 'Default model is available (source: gateway).',
    settingsDefaultModelAvailableViaDirect: 'Default model is available (source: direct).',
    settingsDefaultModelUnavailable: 'Default model is not in the current available model list.',
    settingsDefaultModelValidateFailed: 'Default model validation failed. Please try again later.',
    settingsDiagnosticsFetchFailed: 'Failed to fetch diagnostics. Please try again later.',
    settingsApiKeyPlaceholder: 'sk-...',
    settingsSearchMode: 'Search mode',
    settingsSearchModeHybrid: 'Hybrid',
    settingsSearchModeIterative: 'Iterative',
    settingsSearchModeContext: 'Context',
    settingsRetrievalProfile: 'Profile',
    settingsRetrievalProfilePlaceholder: 'balanced',
    settingsRetrievalMinScore: 'Min score',
    settingsRetrievalBudgetTokens: 'Retrieval budget',
    settingsRetrievalMaxIterations: 'Max iterations',
    settingsRetrievalConfidenceThreshold: 'Confidence threshold',
    settingsAgentContextTypes: 'Reference scope',
    settingsContextTypeWorld: 'World',
    settingsContextTypeCharacter: 'Character',
    settingsContextTypePlot: 'Plot',
    quickPanelTitle: 'Quick command panel',
    quickPanelResultsLabel: 'Command results',
    quickPanelSearchPlaceholder: 'Search commands...',
    quickPanelNoMatch: 'No matching commands',
    quickPanelSelect: '↑↓ Select',
    quickPanelConfirm: '↵ Confirm',
    quickPanelClose: 'ESC Close',
    contentSearchPlaceholder: 'Search content...',
    errorBoundaryTitle: 'Something went wrong',
    errorBoundaryDescription: 'An unexpected error occurred.',
    errorBoundaryTryAgain: 'Try Again',
    errorBoundaryReload: 'Reload Page',
    streamErrorCategory: 'Error Category',
    scrollToBottom: 'Scroll to bottom',
    sidebarNewDocument: 'New Document',
    sidebarContinueWriting: 'Continue writing',
    sidebarDocuments: 'Documents',
    mcpMetricTotal: 'Total',
    mcpMetricFailed: 'Failed',
    mcpMetricAvgLatency: 'Avg Latency',
    mcpMetricMaxLatency: 'Max Latency',
    editorWordCount: 'Words',
    editorCharCount: 'Chars',
    editorReadingTime: '~{min} min read',
    editorAutoSaved: 'Saved',
    editorPlaceholder: 'Type / for AI commands, or just start writing...',
    editorAiGenerating: 'AI generating...',
    editorAiCancel: 'Cancel',
    editorCmdGenerate: 'AI Generate',
    editorCmdGenerateDesc: 'Generate text based on context',
    editorCmdContinue: 'AI Continue',
    editorCmdContinueDesc: 'Continue writing from cursor',
    editorCmdFullArticle: 'AI Full Article',
    editorCmdFullArticleDesc: 'Generate a complete article',
    editorCmdHeading1: 'Heading 1',
    editorCmdHeading1Desc: 'Large heading',
    editorCmdHeading2: 'Heading 2',
    editorCmdHeading2Desc: 'Medium heading',
    editorCmdHeading3: 'Heading 3',
    editorCmdHeading3Desc: 'Small heading',
    editorCmdBulletList: 'Bullet List',
    editorCmdBulletListDesc: 'Create a bullet list',
    editorCmdOrderedList: 'Ordered List',
    editorCmdOrderedListDesc: 'Create an ordered list',
    editorCmdBlockquote: 'Blockquote',
    editorCmdBlockquoteDesc: 'Insert a blockquote',
    editorCmdCodeBlock: 'Code Block',
    editorCmdCodeBlockDesc: 'Insert a code block',
    editorCmdHorizontalRule: 'Divider',
    editorCmdHorizontalRuleDesc: 'Insert a horizontal rule',
    editorBubbleBold: 'Bold',
    editorBubbleItalic: 'Italic',
    editorBubbleStrikethrough: 'Strikethrough',
    editorBubbleRewrite: 'AI Rewrite',
    editorBubblePolish: 'Polish',
    editorBubbleSimplify: 'Simplify',
    editorBubbleExpand: 'Expand',
    editorBubbleFormal: 'Formal',
    editorBubbleCasual: 'Casual',
    editorBubbleContinue: 'Continue',
    exportMarkdown: 'Export Markdown',
    exportHtml: 'Export HTML',

    // Sidebar writer workspace
    writerWorkspaceTitle: 'Current writing project',
    writerWorkspaceHint: 'Chat, review, and knowledge flows stay anchored to this scope.',
    writerStoryBibleLabel: 'Open story notes',
    writerChapterLabel: 'Chapter',
    writerStoryBibleMetaLabel: 'Story bible',
    writerWorkspaceLabel: 'Workspace',

    // ChatArea starter actions
    starterContinueDesc: 'Keep the current tone and momentum, then continue writing.',
    starterRewriteDesc: 'Make the current passage read more smoothly and naturally.',
    starterExpandDesc: 'Add stronger action, setting, and emotional detail.',
    starterAlignCanonDesc: 'Check whether the current content conflicts with existing canon.',
    starterCheckIssuesDesc: 'Identify the most important issues and suggest the next step.',
    starterContinuePrompt: 'Continue writing based on {target}, keeping the current tone, pacing, and story momentum.',
    starterRewritePrompt: 'Rewrite the passage I am drafting in {target} so it reads more smoothly and naturally.',
    starterExpandPrompt: 'Expand the current scene in {target} with stronger action, setting, and emotional detail.',
    starterAlignCanonPrompt: 'Check whether {target} aligns with the established story canon, and point out any conflicts with suggested fixes.',
    starterCheckIssuesPrompt: 'Review the current content in {target}, identify the most important issues to address, and suggest the next step.',
    writerContextTitle: 'Current writing context',
    writerContextHint: 'Chat, templates, and review flows will stay anchored to this project scope. Open "More" for routing, comparison, or rollback.',
    currentDocumentFallback: 'the current document',
  },
}
