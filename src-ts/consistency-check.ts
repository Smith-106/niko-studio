import 'reflect-metadata';
import { pathToFileURL } from 'node:url';

import { mainConsistencyCheckCli } from './mcp/endpoints/critic.js';
import { createLogger } from './logger/index.js';

const log = createLogger('consistency-cli');

export function isConsistencyCheckCliEntry(
  entry: string | undefined = process.argv[1],
  currentUrl: string = import.meta.url,
): boolean {
  if (!entry) {
    return false;
  }

  return currentUrl === pathToFileURL(entry).href;
}

export async function runConsistencyCheckCli(
  runner: typeof mainConsistencyCheckCli = mainConsistencyCheckCli,
  logger: Pick<typeof log, 'error'> = log,
  exit: (code: number) => void = (code) => {
    process.exit(code);
  },
): Promise<void> {
  try {
    await runner();
  } catch (error) {
    logger.error('Consistency check failed', { error: error instanceof Error ? error.message : String(error) });
    exit(1);
  }
}

export function bootstrapConsistencyCheckCli(
  entry: string | undefined = process.argv[1],
  runner: typeof mainConsistencyCheckCli = mainConsistencyCheckCli,
  logger: Pick<typeof log, 'error'> = log,
  exit: (code: number) => void = (code) => {
    process.exit(code);
  },
): boolean {
  if (!isConsistencyCheckCliEntry(entry)) {
    return false;
  }

  void runConsistencyCheckCli(runner, logger, exit);
  return true;
}

bootstrapConsistencyCheckCli();
