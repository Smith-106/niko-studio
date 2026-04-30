import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger, LogLevel, StructuredLogger } from '../../logger';

describe('StructuredLogger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_FORMAT;
  });

  function setupSpies() {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  }

  it('outputs JSON by default', () => {
    setupSpies();
    const l = new StructuredLogger(LogLevel.INFO, 'test');
    l.info('hello', { key: 'value' });

    expect(logSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('info');
    expect(parsed.module).toBe('test');
    expect(parsed.message).toBe('hello');
    expect(parsed.key).toBe('value');
    expect(parsed.timestamp).toBeDefined();
  });

  it('outputs text format when LOG_FORMAT=text', () => {
    process.env.LOG_FORMAT = 'text';
    setupSpies();
    const l = new StructuredLogger(LogLevel.INFO, 'test');
    l.info('hello');

    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy.mock.calls[0][0]).toContain('[INFO] [test] hello');
  });

  it('filters debug messages at INFO level', () => {
    setupSpies();
    const l = new StructuredLogger(LogLevel.INFO, 'test');
    l.debug('should not appear');

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs warn to console.warn', () => {
    setupSpies();
    const l = new StructuredLogger(LogLevel.INFO, 'test');
    l.warn('warning msg');

    expect(warnSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('warn');
  });

  it('logs error to console.error', () => {
    setupSpies();
    const l = new StructuredLogger(LogLevel.INFO, 'test');
    l.error('error msg');

    expect(errorSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('error');
  });

  it('child logger appends module path', () => {
    setupSpies();
    const l = new StructuredLogger(LogLevel.INFO, 'parent');
    const child = l.child('child');
    child.info('child msg');

    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.module).toBe('parent/child');
  });

  it('createLogger creates a child logger', () => {
    setupSpies();
    const mod = createLogger('mymod');
    mod.info('module test');

    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('mymod');
  });

  it('respects SILENT log level', () => {
    setupSpies();
    const l = new StructuredLogger(LogLevel.SILENT, 'test');
    l.error('should not appear');

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('allows debug at DEBUG level', () => {
    setupSpies();
    const l = new StructuredLogger(LogLevel.DEBUG, 'test');
    l.debug('debug msg');

    expect(logSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('debug');
  });
});
