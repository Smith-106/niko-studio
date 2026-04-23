import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';
import {
  getConfig,
  getSecrets,
  reloadConfig,
  setConfigAccess,
  updateConfig,
  updateSecrets,
} from '../../mcp/endpoints/config';

const UI_BRIDGE_ENV_KEY = 'NIKO_UI_BRIDGE_ENABLED';
const ORIGINAL_UI_BRIDGE_ENV = process.env[UI_BRIDGE_ENV_KEY];

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/config',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

afterEach(async () => {
  const { ConfigManager } = await import('../../config/index.js');
  ConfigManager.resetInstance();
  if (ORIGINAL_UI_BRIDGE_ENV === undefined) {
    delete process.env[UI_BRIDGE_ENV_KEY];
  } else {
    process.env[UI_BRIDGE_ENV_KEY] = ORIGINAL_UI_BRIDGE_ENV;
  }
  vi.doUnmock('../../mcp/endpoints/workflow');
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('config endpoints backup parity', () => {
  it('masks backup secrets and preserves the new S3 config fields in getConfig/getSecrets', async () => {
    const getConfigValueMock = vi.fn((key: string) => {
      if (key === 'backup.webdav_password') return 'webdav-secret';
      if (key === 'backup.s3_secret_access_key') return 's3-secret';
      return '';
    });

    setConfigAccess({
      getConfig: () => ({
        backup: {
          backup_dir: '.writing/backups',
          compress: true,
          max_backups: 50,
          webdav_enabled: true,
          webdav_url: 'https://dav.example.com',
          webdav_username: 'writer',
          webdav_password: 'webdav-secret',
          webdav_remote_path: '/backups',
          s3_enabled: true,
          s3_bucket: 'story-bucket',
          s3_prefix: 'archives',
          s3_region: 'ap-southeast-1',
          s3_endpoint_url: 'http://127.0.0.1:9000',
          s3_access_key_id: 'minio',
          s3_secret_access_key: 's3-secret',
          s3_force_path_style: true,
        },
      }),
      getConfigValue: getConfigValueMock,
      setConfigValue: vi.fn(),
      reloadConfig: vi.fn(),
    });

    const configResponse = await getConfig(makeRequest({}));
    const body = configResponse.body as Record<string, unknown>;
    const backup = (body['config'] as Record<string, unknown>)['backup'] as Record<string, unknown>;

    expect(configResponse.statusCode).toBe(200);
    expect(body['modifiable_fields']).toEqual(expect.arrayContaining([
      'backup.s3_endpoint_url',
      'gateway.detection_evasion_guard',
    ]));
    expect(backup).toMatchObject({
      s3_endpoint_url: 'http://127.0.0.1:9000',
      s3_access_key_id: 'minio',
      s3_force_path_style: true,
    });
    expect(backup['webdav_password']).toBe('***MASKED***');
    expect(backup['s3_secret_access_key']).toBe('***MASKED***');

    const secretsResponse = await getSecrets(makeRequest({}));
    expect(secretsResponse.statusCode).toBe(200);
    expect(secretsResponse.body).toMatchObject({
      status: 'ok',
      secrets: {
        'backup.webdav_password': { configured: true, value: '***MASKED***' },
        'backup.s3_secret_access_key': { configured: true, value: '***MASKED***' },
      },
    });
    expect(getConfigValueMock).toHaveBeenCalledWith('backup.s3_secret_access_key');
  });

  it('accepts the new modifiable backup fields and routes the new S3 secret through updateSecrets', async () => {
    const setConfigValueMock = vi.fn();

    setConfigAccess({
      getConfig: () => ({}),
      getConfigValue: vi.fn(),
      setConfigValue: setConfigValueMock,
      reloadConfig: vi.fn(),
    });

    const updateResponse = await updateConfig(makeRequest({
      fields: {
        'backup.s3_endpoint_url': 'http://127.0.0.1:9000',
        'backup.s3_access_key_id': 'minio',
        'backup.s3_force_path_style': true,
        'gateway.detection_evasion_guard': false,
        'integration.dbhub_governance_enabled': true,
        'integration.langflow_flow_name': 'pilot-v2',
      },
    }));

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body).toMatchObject({
      status: 'ok',
      updated: [
        'backup.s3_endpoint_url',
        'backup.s3_access_key_id',
        'backup.s3_force_path_style',
        'gateway.detection_evasion_guard',
        'integration.dbhub_governance_enabled',
        'integration.langflow_flow_name',
      ],
    });

    const updateSecretsResponse = await updateSecrets(makeRequest({
      secrets: {
        'backup.s3_secret_access_key': 'minio-secret',
      },
    }));

    expect(updateSecretsResponse.statusCode).toBe(200);
    expect(updateSecretsResponse.body).toMatchObject({
      status: 'ok',
      updated: ['backup.s3_secret_access_key'],
    });
    expect(setConfigValueMock).toHaveBeenCalledWith('backup.s3_endpoint_url', 'http://127.0.0.1:9000');
    expect(setConfigValueMock).toHaveBeenCalledWith('backup.s3_access_key_id', 'minio');
    expect(setConfigValueMock).toHaveBeenCalledWith('backup.s3_force_path_style', true);
    expect(setConfigValueMock).toHaveBeenCalledWith('gateway.detection_evasion_guard', false);
    expect(setConfigValueMock).toHaveBeenCalledWith('integration.dbhub_governance_enabled', true);
    expect(setConfigValueMock).toHaveBeenCalledWith('integration.langflow_flow_name', 'pilot-v2');
    expect(setConfigValueMock).toHaveBeenCalledWith('backup.s3_secret_access_key', 'minio-secret');
  });

  it('reloads configuration through the shared config access contract', async () => {
    const reloadConfigMock = vi.fn();

    setConfigAccess({
      getConfig: () => ({}),
      getConfigValue: vi.fn(),
      setConfigValue: vi.fn(),
      reloadConfig: reloadConfigMock,
    });

    const response = await reloadConfig({
      method: 'POST',
      url: '/config/reload',
      headers: {},
      body: {},
      query: {},
      params: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      message: 'Configuration reloaded successfully',
    });
    expect(reloadConfigMock).toHaveBeenCalledTimes(1);
  });
});

describe('gateway control plane ui bridge/runtime sync', () => {
  it('binds workflow runtime provider from the container composition root', async () => {
    const setUiBridgeEnabledMock = vi.fn();
    const setWorkflowEngineRuntimeProviderMock = vi.fn();

    vi.doMock('../../mcp/endpoints/workflow', () => ({
      setUiBridgeEnabled: setUiBridgeEnabledMock,
    }));
    vi.doMock('../../container/workflow-runtime-provider.js', () => ({
      setWorkflowEngineRuntimeProvider: setWorkflowEngineRuntimeProviderMock,
    }));

    const { initializeGatewayControlPlane } = await import('../../container/gateway-control-plane.js');
    const workflow = { createRuntime: vi.fn() };

    initializeGatewayControlPlane({ workflow } as Parameters<typeof initializeGatewayControlPlane>[0]);

    expect(setWorkflowEngineRuntimeProviderMock).toHaveBeenCalledTimes(1);
    const provider = setWorkflowEngineRuntimeProviderMock.mock.calls[0]?.[0] as
      | ((params: { workspace: string; sessionNamespace: string }) => unknown)
      | undefined;
    expect(typeof provider).toBe('function');
    provider?.({ workspace: '/tmp/workspace-a', sessionNamespace: 'mcp-workflow' });
    expect(workflow.createRuntime).toHaveBeenCalledWith({
      workspace: '/tmp/workspace-a',
      sessionNamespace: 'mcp-workflow',
    });
  });

  it('initializes the ui bridge runtime from shared config when no env override is present', async () => {
    delete process.env[UI_BRIDGE_ENV_KEY];

    const setUiBridgeEnabledMock = vi.fn();
    vi.doMock('../../mcp/endpoints/workflow', () => ({
      setUiBridgeEnabled: setUiBridgeEnabledMock,
    }));

    const { setConfigValue } = await import('../../config/index.js');
    setConfigValue('gateway.uiBridgeEnabled', true);

    const { initializeGatewayControlPlane } = await import('../../container/gateway-control-plane.js');
    initializeGatewayControlPlane({} as Parameters<typeof initializeGatewayControlPlane>[0]);

    expect(setUiBridgeEnabledMock).toHaveBeenLastCalledWith(true);
  });

  it('resyncs the ui bridge runtime on config updates and explicit reloads', async () => {
    delete process.env[UI_BRIDGE_ENV_KEY];

    const setUiBridgeEnabledMock = vi.fn();
    vi.doMock('../../mcp/endpoints/workflow', () => ({
      setUiBridgeEnabled: setUiBridgeEnabledMock,
    }));

    const { ConfigManager, setConfigValue } = await import('../../config/index.js');
    const { initializeGatewayControlPlane } = await import('../../container/gateway-control-plane.js');

    initializeGatewayControlPlane({} as Parameters<typeof initializeGatewayControlPlane>[0]);
    expect(setUiBridgeEnabledMock).toHaveBeenLastCalledWith(false);

    setConfigValue('gateway.uiBridgeEnabled', true);
    expect(setUiBridgeEnabledMock).toHaveBeenLastCalledWith(true);

    setUiBridgeEnabledMock.mockClear();
    ConfigManager.getInstance().reload();

    expect(setUiBridgeEnabledMock).toHaveBeenCalledTimes(1);
    expect(setUiBridgeEnabledMock).toHaveBeenLastCalledWith(true);
  });
});
