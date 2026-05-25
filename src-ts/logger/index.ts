/**
 * Structured logger for Niko Studio gateway.
 *
 * Provides JSON-formatted log output with configurable levels.
 * Drop-in replacement for console.log/warn/error — no behavioral changes required.
 *
 * Usage:
 *   import { logger } from '../logger';
 *   logger.info('Request processed', { route: '/chat', duration: 123 });
 *   logger.warn('Embedding fallback', { reason: 'no model' });
 *   logger.error('Gateway error', { error: err.message, stack: err.stack });
 */

import { JsonlFileTransport } from './jsonl-file-transport.js';

export { JsonlFileTransport } from './jsonl-file-transport.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
  [LogLevel.SILENT]: 'silent',
};

function parseLevel(env?: string): LogLevel {
  if (!env) return LogLevel.INFO;
  const upper = env.toUpperCase();
  if (upper === 'DEBUG') return LogLevel.DEBUG;
  if (upper === 'WARN' || upper === 'WARNING') return LogLevel.WARN;
  if (upper === 'ERROR') return LogLevel.ERROR;
  if (upper === 'SILENT' || upper === 'OFF') return LogLevel.SILENT;
  return LogLevel.INFO;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(module: string): Logger;
}

export class StructuredLogger implements Logger {
  private readonly _level: LogLevel;
  private readonly _module: string;
  private readonly _jsonOutput: boolean;
  private _transports: JsonlFileTransport[] = [];

  constructor(level?: LogLevel, module?: string) {
    this._level = level ?? parseLevel(process.env.LOG_LEVEL);
    this._module = module ?? 'gateway';
    this._jsonOutput = (process.env.LOG_FORMAT ?? 'json').toLowerCase() === 'json';
  }

  /** Add a file transport for persistent JSONL logging. */
  addTransport(transport: JsonlFileTransport): void {
    this._transports.push(transport);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this._log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this._log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this._log(LogLevel.WARN, message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this._log(LogLevel.ERROR, message, meta);
  }

  child(module: string): Logger {
    const childModule = this._module ? `${this._module}/${module}` : module;
    return new StructuredLogger(this._level, childModule);
  }

  private _log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (level < this._level) return;

    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level: LEVEL_NAMES[level],
      module: this._module,
      message,
    };
    if (meta) {
      Object.assign(entry, meta);
    }

    // Write to all file transports
    for (const transport of this._transports) {
      transport.write(entry);
    }

    if (this._jsonOutput) {
      const output = JSON.stringify(entry);

      if (level >= LogLevel.ERROR) {
        console.error(output);
      } else if (level >= LogLevel.WARN) {
        console.warn(output);
      } else {
        console.log(output);
      }
    } else {
      const prefix = `[${LEVEL_NAMES[level].toUpperCase()}] [${this._module}]`;
      const fullMessage = meta
        ? `${prefix} ${message} ${JSON.stringify(meta)}`
        : `${prefix} ${message}`;

      if (level >= LogLevel.ERROR) {
        console.error(fullMessage);
      } else if (level >= LogLevel.WARN) {
        console.warn(fullMessage);
      } else {
        console.log(fullMessage);
      }
    }
  }
}

/** Default gateway logger instance. */
export const logger: Logger = new StructuredLogger();

/** Create a child logger for a specific module. */
export function createLogger(module: string): Logger {
  return logger.child(module);
}
