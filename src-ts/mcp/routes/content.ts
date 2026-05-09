import {
  chatEndpoint,
  chatStreamEndpoint,
  graphCharacterEndpoint,
  graphForeshadowsEndpoint,
  graphQueryEndpoint,
  memoryAddEndpoint,
  memorySearchEndpoint,
  memoryTemporalEndpoint,
  memoryUploadEndpoint,
  novelQualityCheckEndpoint,
  wikiListEndpoint,
  wikiPromoteEndpoint,
  wikiReadPageEndpoint,
  workspaceContextEndpoint,
  writingHelperProcessEndpoint,
  writingStreamEndpoint,
  writingCraftAnalyzeEndpoint,
  writingCraftLLMEndpoint,
  pluginListEndpoint,
  pluginExecuteEndpoint,
  pluginRegisterEndpoint,
  syncStatusEndpoint,
  syncPushEndpoint,
  syncPullEndpoint,
  syncFullEndpoint,
  foreshadowPlantEndpoint,
  foreshadowStatsEndpoint,
  characterProfileEndpoint,
  characterDepthEndpoint,
  characterRelationshipsEndpoint,
} from '../endpoints';
import type { GatewayRoute } from '../gateway-route-types';

export const contentRoutes: GatewayRoute[] = [
  { method: 'POST', pattern: /^\/chat\/stream$/, handler: chatStreamEndpoint },
  { method: 'POST', pattern: /^\/chat$/, handler: chatEndpoint },
  { method: 'POST', pattern: /^\/memory\/search$/, handler: memorySearchEndpoint },
  { method: 'POST', pattern: /^\/memory\/add$/, handler: memoryAddEndpoint },
  { method: 'POST', pattern: /^\/memory\/upload$/, handler: memoryUploadEndpoint },
  { method: 'POST', pattern: /^\/memory\/temporal$/, handler: memoryTemporalEndpoint },
  { method: 'POST', pattern: /^\/workspace\/context$/, handler: workspaceContextEndpoint },
  { method: 'POST', pattern: /^\/graph\/query$/, handler: graphQueryEndpoint },
  { method: 'POST', pattern: /^\/graph\/character$/, handler: graphCharacterEndpoint },
  { method: 'POST', pattern: /^\/graph\/foreshadows$/, handler: graphForeshadowsEndpoint },
  { method: 'POST', pattern: /^\/wiki\/promote$/, handler: wikiPromoteEndpoint },
  { method: 'POST', pattern: /^\/wiki\/list$/, handler: wikiListEndpoint },
  { method: 'POST', pattern: /^\/wiki\/page$/, handler: wikiReadPageEndpoint },
  { method: 'POST', pattern: /^\/writing\/quality$/, handler: novelQualityCheckEndpoint },
  { method: 'POST', pattern: /^\/writing\/helper$/, handler: writingHelperProcessEndpoint },
  { method: 'POST', pattern: /^\/writing\/stream$/, handler: writingStreamEndpoint },

  // Writing Craft Analysis (M18)
  { method: 'POST', pattern: /^\/writing-craft\/analyze$/, handler: writingCraftAnalyzeEndpoint },
  { method: 'POST', pattern: /^\/writing-craft\/llm-analyze$/, handler: writingCraftLLMEndpoint },

  // Plugins (M19)
  { method: 'GET', pattern: /^\/plugins\/list$/, handler: pluginListEndpoint },
  { method: 'POST', pattern: /^\/plugins\/execute$/, handler: pluginExecuteEndpoint },
  { method: 'POST', pattern: /^\/plugins\/register$/, handler: pluginRegisterEndpoint },

  // Sync (M20)
  { method: 'GET', pattern: /^\/sync\/status$/, handler: syncStatusEndpoint },
  { method: 'POST', pattern: /^\/sync\/push$/, handler: syncPushEndpoint },
  { method: 'POST', pattern: /^\/sync\/pull$/, handler: syncPullEndpoint },
  { method: 'POST', pattern: /^\/sync\/full$/, handler: syncFullEndpoint },

  // Foreshadow CRUD
  { method: 'POST', pattern: /^\/foreshadow\/plant$/, handler: foreshadowPlantEndpoint },
  { method: 'GET', pattern: /^\/foreshadow\/stats$/, handler: foreshadowStatsEndpoint },

  // Character analysis
  { method: 'POST', pattern: /^\/character\/profile$/, handler: characterProfileEndpoint },
  { method: 'POST', pattern: /^\/character\/depth$/, handler: characterDepthEndpoint },
  { method: 'POST', pattern: /^\/character\/relationships$/, handler: characterRelationshipsEndpoint },
];
