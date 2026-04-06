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

  static async loadFileAsync(fileBuffer: Buffer, fileName: string): Promise<string> {
    const fileExt = fileName.split('.').pop()!.toLowerCase();

    try {
      if (fileExt === 'txt' || fileExt === 'md') {
        return DocumentLoader.loadText(fileBuffer);
      } else if (fileExt === 'pdf') {
        return await DocumentLoader.loadPdfAsync(fileBuffer);
      } else if (fileExt === 'docx' || fileExt === 'doc') {
        if (fileExt === 'doc') {
          throw new Error('Legacy .doc format is not supported. Please convert to .docx');
        }
        return await DocumentLoader.loadDocxAsync(fileBuffer);
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
    void fileBuffer;
    throw new Error('PDF parsing is not available in the current TypeScript runtime. Use txt/md files for upload.');
  }

  /**
   * Load DOCX content from a buffer
   *
   * Note: Requires a DOCX parsing library such as `mammoth` or `docx-parser`.
   */
  private static loadDocx(fileBuffer: Buffer): string {
    void fileBuffer;
    throw new Error('DOCX parsing is not available in the current TypeScript runtime. Use txt/md files for upload.');
  }

  private static async loadPdfAsync(fileBuffer: Buffer): Promise<string> {
    try {
      const pdfParseMod = await import('pdf-parse') as {
        PDFParse?: new (options: { data: Buffer }) => {
          getText: () => Promise<{ text?: string }>;
          destroy?: () => Promise<void> | void;
        };
      };
      const PDFParse = pdfParseMod.PDFParse;

      if (typeof PDFParse !== 'function') {
        throw new Error('pdf-parse PDFParse export is unavailable');
      }

      const parser = new PDFParse({ data: fileBuffer });
      try {
        const result = await parser.getText();
        return result.text ?? '';
      } finally {
        await parser.destroy?.();
      }
    } catch {
      throw new Error('pdf-parse is required for PDF support. Install with: npm install pdf-parse');
    }
  }

  private static async loadDocxAsync(fileBuffer: Buffer): Promise<string> {
    try {
      const mammothMod = await import('mammoth') as {
        extractRawText?: (options: { buffer: Buffer }) => Promise<{ value?: string }>;
        default?: {
          extractRawText?: (options: { buffer: Buffer }) => Promise<{ value?: string }>;
        };
      };
      const extractRawText =
        mammothMod.extractRawText ??
        mammothMod.default?.extractRawText;

      if (typeof extractRawText !== 'function') {
        throw new Error('mammoth.extractRawText is unavailable');
      }

      const result = await extractRawText({ buffer: fileBuffer });
      return result.value ?? '';
    } catch {
      throw new Error('mammoth is required for DOCX support. Install with: npm install mammoth');
    }
  }
}
