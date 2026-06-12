import { afterEach, describe, expect, it, vi } from 'vitest';

import { InMemoryRateLimiter } from '../../mcp/rate-limiter';

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter;

  afterEach(() => {
    limiter?.stop();
  });

  it('allows requests within the limit', () => {
    limiter = new InMemoryRateLimiter(3600);
    for (let i = 0; i < 10; i++) {
      expect(limiter.allow('test-key', 10, 60)).toBe(true);
    }
  });

  it('blocks requests exceeding the limit', () => {
    limiter = new InMemoryRateLimiter(3600);
    for (let i = 0; i < 5; i++) {
      limiter.allow('block-test', 5, 60);
    }
    expect(limiter.allow('block-test', 5, 60)).toBe(false);
  });

  it('tracks different keys independently', () => {
    limiter = new InMemoryRateLimiter(3600);
    for (let i = 0; i < 3; i++) {
      limiter.allow('key-a', 3, 60);
    }
    expect(limiter.allow('key-a', 3, 60)).toBe(false);
    expect(limiter.allow('key-b', 3, 60)).toBe(true);
  });

  it('cleans up expired windows', () => {
    limiter = new InMemoryRateLimiter(3600);
    limiter.allow('cleanup-test', 1, 0);
    // Force cleanup
    limiter.cleanup();
    // After cleanup, the expired window should be gone, so a new request is allowed
    expect(limiter.allow('cleanup-test', 1, 60)).toBe(true);
  });

  it('start and stop do not throw', () => {
    limiter = new InMemoryRateLimiter(3600);
    expect(() => limiter.start()).not.toThrow();
    expect(() => limiter.start()).not.toThrow();
    expect(() => limiter.stop()).not.toThrow();
    expect(() => limiter.stop()).not.toThrow();
  });

  it('reports current window counts and falls back to zero for missing windows', () => {
    limiter = new InMemoryRateLimiter(3600);

    expect(limiter.getCount('diagnostic-key', 10, 60)).toBe(0);
    expect(limiter.allow('diagnostic-key', 10, 60)).toBe(true);
    expect(limiter.allow('diagnostic-key', 10, 60)).toBe(true);
    expect(limiter.getCount('diagnostic-key', 10, 60)).toBe(2);
  });

  it('runs cleanup when the entry cap is exceeded', () => {
    limiter = new InMemoryRateLimiter(3600, 0);
    const cleanupSpy = vi.spyOn(limiter, 'cleanup');

    expect(limiter.allow('capped-key', 10, 60)).toBe(true);
    expect(limiter.allow('capped-key', 10, 60)).toBe(true);
    expect(cleanupSpy).toHaveBeenCalled();
  });
});
