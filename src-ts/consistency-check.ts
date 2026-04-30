import 'reflect-metadata';
import { pathToFileURL } from 'node:url';

import { mainConsistencyCheckCli } from './mcp/endpoints/critic.js';
import { createLogger } from './logger/index.js';

const log = createLogger('consistency-cli');

const runningAsMain = (() => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return import.meta.url === pathToFileURL(entry).href;
})();

if (runningAsMain) {
  mainConsistencyCheckCli().catch((error) => {
    log.error('Consistency check failed', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}
