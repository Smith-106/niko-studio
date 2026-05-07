import { describe, expect, it } from 'vitest';
import { pluginListEndpoint, pluginExecuteEndpoint, pluginRegisterEndpoint } from '../../mcp/endpoints/plugins.js';
import { pluginEngine } from '../../plugins/plugin-engine.js';
import '../../plugins/index.js';

function mockRequest(body: Record<string, unknown>) {
  return {
    method: 'POST',
    url: '/plugins/list',
    headers: {},
    body,
    query: {},
    params: {},
  } as any;
}

describe('Plugin MCP Endpoints', () => {
  it('lists registered plugins', async () => {
    const response = await pluginListEndpoint({ method: 'GET', url: '', headers: {}, body: {}, query: {}, params: {} } as any);
    expect(response.statusCode).toBe(200);
    const body = response.body as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.plugins)).toBe(true);
  });

  it('returns 400 when text is missing for execute', async () => {
    const response = await pluginExecuteEndpoint(mockRequest({ pluginId: 'builtin-rhythm-checker' }));
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when pluginId is missing for execute', async () => {
    const response = await pluginExecuteEndpoint(mockRequest({ text: 'some text' }));
    expect(response.statusCode).toBe(400);
  });

  it('executes a builtin plugin', async () => {
    const response = await pluginExecuteEndpoint(
      mockRequest({ text: '第一段。第二段。第三段。', pluginId: 'builtin-rhythm-checker' }),
    );
    expect(response.statusCode).toBe(200);
    const body = response.body as any;
    expect(body.success).toBe(true);
    expect(body.data.results).toHaveLength(1);
    expect(body.data.results[0].pluginId).toBe('builtin-rhythm-checker');
  });

  it('registers and executes a user plugin', async () => {
    const regResponse = await pluginRegisterEndpoint(
      mockRequest({
        id: 'test-user-plugin',
        name: 'Test User Plugin',
        rules: [{ keyword: '测试', score: 1, evidence: '检测到{count}处测试', suggestion: '减少测试字样' }],
      }),
    );
    expect(regResponse.statusCode).toBe(200);
    const regBody = regResponse.body as any;
    expect(regBody.success).toBe(true);

    const execResponse = await pluginExecuteEndpoint(
      mockRequest({ text: '这是一段测试文本，测试功能。', pluginId: 'test-user-plugin' }),
    );
    expect(execResponse.statusCode).toBe(200);
    const execBody = execResponse.body as any;
    expect(execBody.data.results).toHaveLength(1);
    expect(execBody.data.results[0].score).toBeGreaterThan(0);
    expect(execBody.data.results[0].evidence.length).toBeGreaterThan(0);

    pluginEngine.unregister('test-user-plugin');
  });

  it('returns 400 for invalid register request', async () => {
    const response = await pluginRegisterEndpoint(mockRequest({}));
    expect(response.statusCode).toBe(400);
  });
});
