/**
 * Vitest global teardown — ensures native SQLite handles are released
 * before the process exits, preventing segfault on Windows.
 */
export default async function teardown() {
  try {
    const { closeAllPools } = await import('../db/pool.js');
    closeAllPools();
  } catch {
    // Pool module may not be loaded — safe to ignore
  }
}
