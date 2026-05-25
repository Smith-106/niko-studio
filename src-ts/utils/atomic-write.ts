import { writeFileSync, renameSync, mkdirSync, writeFile } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Atomic file write utility.
 *
 * Writes to a temporary file first, then renames to the target path.
 * renameSync is atomic on most filesystems (POSIX, NTFS), ensuring
 * the target file is never in a partially-written state.
 *
 * Pattern learned from maestro-flow's FileDelegateBroker.
 */

/**
 * Synchronous atomic write. Ensures target file is never partially written.
 */
export function atomicWriteSync(filePath: string, data: string | Buffer): void {
  const tmpPath = `${filePath}.tmp`;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(tmpPath, data);
  renameSync(tmpPath, filePath);
}

/**
 * Asynchronous atomic write. Ensures target file is never partially written.
 */
export async function atomicWriteFile(filePath: string, data: string | Buffer): Promise<void> {
  const { mkdir, writeFile: writeFileAsync, rename } = await import('node:fs/promises');
  const tmpPath = `${filePath}.tmp`;
  await mkdir(dirname(filePath), { recursive: true });
  await writeFileAsync(tmpPath, data);
  await rename(tmpPath, filePath);
}
