import { describe, expect, it } from 'vitest';

import * as gatewayRouteTypes from '../../mcp/gateway-route-types.js';
import * as memoryStoreProtocol from '../../memory/imemory-store.js';
import * as visualizationTypes from '../../narrative/types/visualization-types.js';
import * as agentProtocol from '../../protocols/agent.js';
import * as fileSyncProtocol from '../../protocols/file-sync.js';
import * as personalizationProtocol from '../../protocols/personalization.js';
import * as revisionProtocol from '../../protocols/revision.js';
import * as searchProtocol from '../../protocols/search.js';
import * as serviceProtocol from '../../protocols/service.js';
import * as sessionIntelligenceProtocol from '../../protocols/session-intelligence.js';

describe('additional protocol runtime modules', () => {
  it('loads type-only protocol modules as side-effect free runtime modules', () => {
    expect(Object.keys(agentProtocol)).toEqual([]);
    expect(Object.keys(serviceProtocol)).toEqual([]);
    expect(Object.keys(searchProtocol)).toEqual([]);
    expect(Object.keys(fileSyncProtocol)).toEqual([]);
    expect(Object.keys(sessionIntelligenceProtocol)).toEqual([]);
    expect(Object.keys(revisionProtocol)).toEqual([]);
    expect(Object.keys(personalizationProtocol)).toEqual([]);
    expect(Object.keys(memoryStoreProtocol)).toEqual([]);
    expect(Object.keys(visualizationTypes)).toEqual([]);
    expect(Object.keys(gatewayRouteTypes)).toEqual([]);
  });
});
