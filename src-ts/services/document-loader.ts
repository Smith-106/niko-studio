/**
 * DocumentLoader - File content extraction service
 *
 * Migrated from src/services/document_loader.py.
 *
 * Supports: txt, md, pdf, docx
 */

import { createHash } from 'node:crypto';

/**
 * Service to load and parse content from uploaded files.
 * Supports: txt, md, pdf, docx
 */
export class DocumentLoader {
  /**
   * Extract text from a file buffer based on its extension.
   *
   * @param fileBuffer - The file buffer containing the document
   * @param fileName - The name of the file (used for extension detection)
   * @returns Extracted text content
   */
  static loadFile(fileBuffer: Buffer, fileName: string): string {
    const fileExt = fileName.split('.').pop()!.toLowerCase();

    try {
      if (fileExt === 'txt' || fileExt === 'md') {
        return DocumentLoader.loadText(fileBuffer);
      } else if (fileExt === 'pdf') {
        return DocumentLoader.loadPdf(fileBuffer);
      } else if (fileExt === 'docx' || fileExt === 'doc') {
        if (fileExt === 'doc') {
          throw new Error('Legacy .doc format is not supported. Please convert to .docx');
        }
        return DocumentLoader.loadDocx(fileBuffer);
      } else {
        throw new Error(`Unsupported file format: ${fileExt}`);
      }
    } catch (e) {
      console.error(`Error loading file ${fileName}: ${e}`);
      throw e;
    }
  }

  /**
   * Load text content from a buffer (txt/md files)
   */
  private static loadText(fileBuffer: Buffer): string {
    return fileBuffer.toString('utf-8');
  }

  /**
   * Load PDF content from a buffer
   *
   * Note: In a Node.js environment, this requires a PDF parsing library
   * such as `pdf-parse` or `pdfjs-dist`. The implementation here is a
   * placeholder that throws if the library is not available.
   */
  private static loadPdf(fileBuffer: Buffer): string {
    // PDF parsing requires an external library.
    // Attempting dynamic require to avoid hard dependency.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse');
      // pdf-parse is callback-based but also returns a promise
      return pdfParse(fileBuffer).then((data: { text: string }) => data.text);
    } catch {
      throw new Error('pdf-parse is required for PDF support. Install with: npm install pdf-parse');
    }
  }

  /**
   * Load DOCX content from a buffer
   *
   * Note: Requires a DOCX parsing library such as `mammoth` or `docx-parser`.
   */
  private static loadDocx(fileBuffer: Buffer): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth');
      return mammoth.extractRawText({ buffer: fileBuffer }).then((data: { value: string }) => data.value);
    } catch {
      throw new Error('mammoth is required for DOCX support. Install with: npm install mammoth');
    }
  }
}
