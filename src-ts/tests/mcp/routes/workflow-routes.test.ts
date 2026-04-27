import { describe, expect, it } from 'vitest';

import { workflowRoutes } from '../../../mcp/routes/workflow';

describe('workflowRoutes', () => {
  it('should have 24 routes', () => {
    expect(workflowRoutes).toHaveLength(24);
  });

  it('every route has a valid method', () => {
    const validMethods = new Set(['GET', 'PUT', 'POST', 'DELETE', 'PATCH']);
    for (const route of workflowRoutes) {
      expect(validMethods.has(route.method)).toBe(true);
    }
  });

  it('every route handler is a function', () => {
    for (const route of workflowRoutes) {
      expect(typeof route.handler).toBe('function');
    }
  });

  it('every route has a RegExp pattern', () => {
    for (const route of workflowRoutes) {
      expect(route.pattern).toBeInstanceOf(RegExp);
    }
  });

  it('all workflow routes use POST method', () => {
    for (const route of workflowRoutes) {
      expect(route.method).toBe('POST');
    }
  });

  // ---------------------------------------------------------------------------
  // Core workflow endpoints
  // ---------------------------------------------------------------------------
  describe('core workflow endpoints', () => {
    const coreEndpoints = [
      '/workflow/route',
      '/workflow/plan',
      '/workflow/execute',
      '/workflow/lifecycle',
      '/workflow/rollback',
    ];

    for (const endpoint of coreEndpoints) {
      it(`has POST ${endpoint}`, () => {
        const r = workflowRoutes.find(
          (rt) => rt.method === 'POST' && rt.pattern.test(endpoint),
        );
        expect(r).toBeDefined();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Scheduler endpoints
  // ---------------------------------------------------------------------------
  describe('scheduler endpoints', () => {
    const schedulerEndpoints = [
      '/workflow/scheduler/register',
      '/workflow/scheduler/list',
      '/workflow/scheduler/pause',
      '/workflow/scheduler/resume',
      '/workflow/scheduler/run-now',
      '/workflow/scheduler/import-lite-plan',
    ];

    for (const endpoint of schedulerEndpoints) {
      it(`has POST ${endpoint}`, () => {
        const r = workflowRoutes.find(
          (rt) => rt.method === 'POST' && rt.pattern.test(endpoint),
        );
        expect(r).toBeDefined();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Checkpoint endpoints
  // ---------------------------------------------------------------------------
  describe('checkpoint endpoints', () => {
    const checkpointEndpoints = [
      '/checkpoint/create',
      '/checkpoint/restore',
      '/checkpoint/list',
    ];

    for (const endpoint of checkpointEndpoints) {
      it(`has POST ${endpoint}`, () => {
        const r = workflowRoutes.find(
          (rt) => rt.method === 'POST' && rt.pattern.test(endpoint),
        );
        expect(r).toBeDefined();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // UI-bridge workflow endpoints
  // ---------------------------------------------------------------------------
  describe('ui-bridge workflow endpoints', () => {
    const uiBridgeEndpoints = [
      '/ui-bridge/workflow/route',
      '/ui-bridge/workflow/plan',
      '/ui-bridge/workflow/execute',
      '/ui-bridge/workflow/lifecycle',
    ];

    for (const endpoint of uiBridgeEndpoints) {
      it(`has POST ${endpoint}`, () => {
        const r = workflowRoutes.find(
          (rt) => rt.method === 'POST' && rt.pattern.test(endpoint),
        );
        expect(r).toBeDefined();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // UI-bridge scheduler endpoints
  // ---------------------------------------------------------------------------
  describe('ui-bridge scheduler endpoints', () => {
    const uiBridgeSchedulerEndpoints = [
      '/ui-bridge/workflow/scheduler/register',
      '/ui-bridge/workflow/scheduler/list',
      '/ui-bridge/workflow/scheduler/pause',
      '/ui-bridge/workflow/scheduler/resume',
      '/ui-bridge/workflow/scheduler/run-now',
      '/ui-bridge/workflow/scheduler/import-lite-plan',
    ];

    for (const endpoint of uiBridgeSchedulerEndpoints) {
      it(`has POST ${endpoint}`, () => {
        const r = workflowRoutes.find(
          (rt) => rt.method === 'POST' && rt.pattern.test(endpoint),
        );
        expect(r).toBeDefined();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Pattern specificity tests
  // ---------------------------------------------------------------------------
  describe('pattern specificity', () => {
    it('/workflow/execute matches correctly', () => {
      const r = workflowRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/workflow/execute'),
      );
      expect(r).toBeDefined();
    });

    it('/workflow/executeX does NOT match /workflow/execute', () => {
      const r = workflowRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/workflow/executeX'),
      );
      expect(r).toBeUndefined();
    });

    it('/workflow/route does NOT match /workflow/route/extra', () => {
      const r = workflowRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/workflow/route/extra'),
      );
      expect(r).toBeUndefined();
    });

    it('/workflow does NOT match any workflow route', () => {
      const r = workflowRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/workflow'),
      );
      expect(r).toBeUndefined();
    });

    it('/workflow/ does NOT match any workflow route', () => {
      const r = workflowRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/workflow/'),
      );
      expect(r).toBeUndefined();
    });

    it('/checkpoint/create matches but /checkpoint/createX does not', () => {
      const match = workflowRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/checkpoint/create'),
      );
      expect(match).toBeDefined();

      const noMatch = workflowRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/checkpoint/createX'),
      );
      expect(noMatch).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Count breakdown verification
  // ---------------------------------------------------------------------------
  describe('route count breakdown', () => {
    it('has 5 core workflow routes', () => {
      const core = workflowRoutes.filter(
        (rt) => rt.pattern.source.startsWith('^\\/workflow\\/'),
      );
      // /workflow/route, /plan, /execute, /lifecycle, /rollback = 5
      // plus /workflow/scheduler/* = 6, total 11 under /workflow/
      expect(core.length).toBeGreaterThanOrEqual(5);
    });

    it('has 3 checkpoint routes', () => {
      const checkpoints = workflowRoutes.filter(
        (rt) => rt.pattern.source.startsWith('^\\/checkpoint\\/'),
      );
      expect(checkpoints).toHaveLength(3);
    });

    it('has 10 ui-bridge routes', () => {
      const uiBridge = workflowRoutes.filter(
        (rt) => rt.pattern.source.startsWith('^\\/ui-bridge\\/'),
      );
      expect(uiBridge).toHaveLength(10);
    });
  });
});
