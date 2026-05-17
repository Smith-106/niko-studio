type McpKeys =
  'mcpPanelAriaLabel'
  | 'mcpPanelTitle'
  | 'mcpRefresh'
  | 'mcpRefreshing'
  | 'mcpCloseAria'
  | 'mcpFetchPartialError'
  | 'mcpFetchFailed'
  | 'mcpProbeFailed'
  | 'mcpUpdateFailed'
  | 'mcpServiceIdRequired'
  | 'mcpCreateFailed'
  | 'mcpGatewayStatus'
  | 'mcpGatewayHealth'
  | 'mcpSessionId'
  | 'mcpNotAvailable'
  | 'mcpReconnect'
  | 'mcpLastErrorPrefix'
  | 'mcpKeyServiceStatus'
  | 'mcpServiceOnline'
  | 'mcpServiceNotReady'
  | 'mcpRuntimeMetrics'
  | 'mcpRequestsTotal'
  | 'mcpRequestsFailed'
  | 'mcpLatencyAvg'
  | 'mcpLatencyMax'
  | 'mcpNoMetricsData'
  | 'mcpServiceDynamicConfig'
  | 'mcpServiceIdPlaceholder'
  | 'mcpServiceNamePlaceholder'
  | 'mcpServicePathPlaceholder'
  | 'mcpCreating'
  | 'mcpCreateService'
  | 'mcpServiceEnabled'
  | 'mcpServiceDisabled'
  | 'mcpSaving'
  | 'mcpSaveName'
  | 'mcpDisable'
  | 'mcpEnable'
  | 'mcpBuiltinServiceCannotToggle'
  | 'mcpProbing'
  | 'mcpHealthCheck'
  | 'mcpNoServiceConfigData'
  | 'mcpToolStats'
  | 'mcpTotalTools'
  | 'mcpNoToolData'
  | 'mcpStatusOk'
  | 'mcpStatusError'
  | 'mcpStatusDisabled'
  | 'mcpStatusUnknown'
  | 'mcpConnectionConnected'
  | 'mcpConnectionDegraded'
  | 'mcpConnectionDisconnected'
  | 'mcpConnectionReconnecting'
  | 'mcpReconnectIdle'
  | 'mcpReconnectProbing'
  | 'mcpReconnectBackoff'
  | 'mcpReconnectRetrying'
  | 'mcpReconnectRecovered'
  | 'mcpReconnectFailed'
  | 'mcpRuntimeDiagnostics'
  | 'mcpDiagnosticClass'
  | 'runtimeUnavailableLabel'
  | 'runtimeUnavailableMessage'
  | 'packagedPrerequisiteMissingLabel'
  | 'packagedPrerequisiteMissingMessage'
  | 'embeddingAuthorityUnavailableLabel'
  | 'embeddingAuthorityUnavailableMessage'
  | 'parserMissingLabel'
  | 'parserMissingMessage'
  | 'integrationDegradedLabel'
  | 'integrationDegradedMessage'

export type Translations = Record<McpKeys, string>

export const zhMcp: Translations = {
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
}

export const enMcp: Translations = {
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
}
