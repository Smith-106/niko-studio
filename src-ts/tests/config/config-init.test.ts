import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ConfigManager, getConfig, initConfig } from '../../config';

describe('initConfig app config resolution', () => {
  afterEach(() => {
    ConfigManager.resetInstance();
    delete process.env.NIKO_APP_CONFIG_PATH;
  });

  it('prefers NIKO_APP_CONFIG_PATH over cwd config discovery', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-app-config-'));
    const configPath = path.join(tempDir, 'niko-studio.yaml');

    fs.writeFileSync(configPath, 'version: "11.0.0"\ngateway:\n  cors_prod_origins:\n    - tauri://localhost\n', 'utf-8');

    process.env.NIKO_APP_CONFIG_PATH = configPath;

    initConfig(undefined, false);

    expect(getConfig().version).toBe('11.0.0');
    expect(getConfig().gateway.corsProdOrigins).toEqual(['tauri://localhost']);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
