/**
 * Database Index Tests
 *
 * Tests that the db module barrel exports are correct.
 */

import { describe, expect, it } from 'vitest';

describe('db/index', () => {
  it('exports AsyncConnectionPool', async () => {
    const mod = await import('../../db/index');
    expect(mod.AsyncConnectionPool).toBeDefined();
  });

  it('exports getPool', async () => {
    const mod = await import('../../db/index');
    expect(mod.getPool).toBeDefined();
    expect(typeof mod.getPool).toBe('function');
  });

  it('exports closeAllPools', async () => {
    const mod = await import('../../db/index');
    expect(mod.closeAllPools).toBeDefined();
    expect(typeof mod.closeAllPools).toBe('function');
  });
});
