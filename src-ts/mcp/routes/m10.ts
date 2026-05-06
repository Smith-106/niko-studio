import {
  reviseMultiPassEndpoint,
  styleExtractEndpoint,
  styleProfileEndpoint,
  styleApplyEndpoint,
  crossChapterConsistencyEndpoint,
  contextAwareSuggestionsEndpoint,
} from '../endpoints';
import type { GatewayRoute } from '../gateway-route-types';

export const m10Routes: GatewayRoute[] = [
  { method: 'POST', pattern: /^\/agent\/revise-multi-pass$/, handler: reviseMultiPassEndpoint },
  { method: 'POST', pattern: /^\/style\/extract$/, handler: styleExtractEndpoint },
  { method: 'GET', pattern: /^\/style\/profile\/(.+)$/, handler: styleProfileEndpoint, paramNames: ['projectId'] },
  { method: 'POST', pattern: /^\/style\/apply$/, handler: styleApplyEndpoint },
  { method: 'POST', pattern: /^\/consistency\/cross-chapter$/, handler: crossChapterConsistencyEndpoint },
  { method: 'POST', pattern: /^\/suggestions\/context-aware$/, handler: contextAwareSuggestionsEndpoint },
];
