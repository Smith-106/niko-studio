import { describe, expect, it } from 'vitest';

import { buildGatewayDeps } from '../../mcp/gateway-state';

describe('mcp/gateway-state tail fallback coverage', () => {
  it('serializes unknown runtime service configs through the local fallback object shape', () => {
    const deps = buildGatewayDeps({} as never);

    expect(
      deps.serializeServiceConfig(
        {
          id: ' ad-hoc ',
          path: '/ad-hoc',
        },
        {},
      ),
    ).toMatchObject({
      id: 'ad-hoc',
      name: 'ad-hoc',
      path: '/ad-hoc',
      status: 'unknown',
    });
  });
});
