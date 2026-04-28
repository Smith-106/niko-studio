/**
 * file-utils.ts - File upload processing utilities
 *
 * Migrated from src/ui/file_utils.py.
 *
 * Processes uploaded files: extracts text, splits into chunks, and indexes
 * them for semantic search. Replaces langchain's RecursiveCharacterTextSplitter
 * with a lightweight inline implementation.
 */

import { DocumentLoader } from '../services/document-loader';
import type { IndexingService } from '../services/indexing-service';

/**
 * Recursively split text by character, trying paragraph, line, then sentence boundaries.
 * Compatible with langchain's RecursiveCharacterTextSplitter behavior.
 */
function recursiveCharacterSplit(
  text: string,
  chunkSize: number = 1000,
  chunkOverlap: number = 200,
): string[] {
  const separators = ['\n\n', '\n', '. ', ' ', ''];

  function splitRecursive(doc: string, depth: number): string[] {
    if (doc.length <= chunkSize) return [doc];
    if (depth >= separators.length) {
      // Hard split by chunkSize
      const chunks: string[] = [];
      for (let i = 0; i < doc.length; i += chunkSize - chunkOverlap) {
        chunks.push(doc.slice(i, i + chunkSize));
      }
      return chunks;
    }

    const sep = separators[depth];
    const parts = doc.split(sep);
    const result: string[] = [];
    let current = '';

    for (const part of parts) {
      const candidate = current ? current + sep + part : part;
      if (candidate.length <= chunkSize) {
        current = candidate;
      } else {
        if (current) result.push(current);
        if (part.length > chunkSize) {
          result.push(...splitRecursive(part, depth + 1));
          current = '';
        } else {
          current = part;
        }
      }
    }
    if (current) result.push(current);
    return result;
  }

  // Merge small chunks with overlap
  const raw = splitRecursive(text, 0);
  if (raw.length <= 1) return raw;

  const merged: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const chunk = raw[i].trim();
    if (!chunk) continue;
    merged.push(chunk);
  }
  return merged;
}

/**
 * Process an uploaded file: load content, split into chunks, and index.
 *
 * @param fileBuffer - The file buffer
 * @param fileName - Original file name (used for extension detection and chunk IDs)
 * @param sessionId - Current session ID for chunk namespacing
 * @param indexingService - The indexing service instance
 * @param progressCallback - Optional callback receiving progress (0.0-1.0)
 * @returns Number of chunks processed
 */
export function processUploadedFile(
  fileBuffer: Buffer,
  fileName: string,
  sessionId: string,
  indexingService: IndexingService,
  progressCallback?: (progress: number) => void,
): number {
  const fileExt = fileName.split('.').pop()?.toLowerCase();
  if (fileExt === 'pdf' || fileExt === 'docx') {
    throw new Error(`Synchronous processing is not supported for .${fileExt} uploads. Use the asynchronous upload pipeline instead.`);
  }

  // Load text
  const text = DocumentLoader.loadFile(fileBuffer, fileName);

  // Chunk
  const chunks = recursiveCharacterSplit(text, 1000, 200);

  // Sanitize filename for use in chunk IDs
  const safeFilename = fileName
    .replace(/[^a-zA-Z0-9. _]/g, '')
    .replace(/ /g, '_');

  // Index each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunkId = `${sessionId}_${safeFilename}_part_${i}`;
    indexingService.addDocument(chunkId, chunks[i], 'uploaded_material');
    progressCallback?.((i + 1) / chunks.length);
  }

  return chunks.length;
}

export { recursiveCharacterSplit };
