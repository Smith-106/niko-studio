import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfigManager, setConfigValue } from '../../config';
import { buildConfigAccess } from '../../mcp/gateway-state';
import { resolveCorsOrigins } from '../../mcp/config';

afterEach(() => {
  ConfigManager.resetInstance();
  delete process.env.NIKO_ENV;
  delete process.env.NIKO_CORS_DEV_ORIGINS;
  delete process.env.NIKO_CORS_PROD_ORIGINS;
  vi.restoreAllMocks();
});

describe('config reload updates cors resolver', () => {
  it('switches from initial deny to allow after reload in development', () => {
    process.env.NIKO_ENV = 'development';
    setConfigValue('gateway.corsDevOrigins', ['http://origin-a.local']);

    expect(resolveCorsOrigins()).toEqual(['http://origin-a.local']);

    setConfigValue('gateway.corsDevOrigins', ['http://origin-b.local']);
    const access = buildConfigAccess();
    access.reloadConfig();

    expect(resolveCorsOrigins()).toEqual(['http://origin-b.local']);
  });

  it('switches from initial deny to allow after reload in production', () => {
    process.env.NIKO_ENV = 'production';
    setConfigValue('gateway.corsProdOrigins', ['https://prod-a.example.com']);

    expect(resolveCorsOrigins()).toEqual(['https://prod-a.example.com']);

    setConfigValue('gateway.corsProdOrigins', ['https://prod-b.example.com']);
    const access = buildConfigAccess();
    access.reloadConfig();

    expect(resolveCorsOrigins()).toEqual(['https://prod-b.example.com']);
  });
});
