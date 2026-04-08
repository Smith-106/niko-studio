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
  workspaceContextEndpoint,
  writingHelperProcessEndpoint,
  writingStreamEndpoint,
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
  { method: 'POST', pattern: /^\/writing\/quality$/, handler: novelQualityCheckEndpoint },
  { method: 'POST', pattern: /^\/writing\/helper$/, handler: writingHelperProcessEndpoint },
  { method: 'POST', pattern: /^\/writing\/stream$/, handler: writingStreamEndpoint },
  { method: 'POST', pattern: /^\/writing-helper\/process$/, handler: writingHelperProcessEndpoint },
];
