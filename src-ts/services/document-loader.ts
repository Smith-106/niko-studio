/**
 * DocumentLoader - File content extraction service
 *
 * Migrated from src/services/document_loader.py.
 *
 * Supports: txt, md, pdf, docx
 */

export type DocumentParserName = 'builtin-text' | 'pdf-parse' | 'mammoth';
export type DocumentLoadMode = 'sync' | 'async';
export type DocumentLoadErrorCode =
  | 'UNSUPPORTED_FILE_TYPE'
  | 'UNSUPPORTED_LEGACY_DOC'
  | 'ASYNC_PARSER_REQUIRED'
  | 'PARSER_PREREQUISITE_MISSING'
  | 'PARSE_FAILED';

export interface DocumentLoadErrorMetadata {
  code: DocumentLoadErrorCode;
  fileType: string;
  mode: DocumentLoadMode;
  parser?: DocumentParserName;
  dependency?: string;
  installCommand?: string;
  detail: string;
  action?: string;
}

export class DocumentLoadError extends Error {
  readonly code: DocumentLoadErrorCode;
  readonly fileType: string;
  readonly mode: DocumentLoadMode;
  readonly parser?: DocumentParserName;
  readonly dependency?: string;
  readonly installCommand?: string;
  readonly detail: string;
  readonly action?: string;

  constructor(message: string, metadata: DocumentLoadErrorMetadata) {
    super(message);
    this.name = 'DocumentLoadError';
    this.code = metadata.code;
    this.fileType = metadata.fileType;
    this.mode = metadata.mode;
    this.parser = metadata.parser;
    this.dependency = metadata.dependency;
    this.installCommand = metadata.installCommand;
    this.detail = metadata.detail;
    this.action = metadata.action;
  }

  toResponseBody(fileName: string): Record<string, unknown> {
    return {
      error: this.message,
      error_code: this.code,
      file_name: fileName,
      file_type: this.fileType,
      mode: this.mode,
      parser: this.parser ?? null,
      dependency: this.dependency ?? null,
      install_command: this.installCommand ?? null,
      detail: this.detail,
      action: this.action ?? null,
    };
  }
}

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
    const fileExt = DocumentLoader.getFileExtension(fileName);

    try {
      if (fileExt === 'txt' || fileExt === 'md') {
        return DocumentLoader.loadText(fileBuffer);
      }
      if (fileExt === 'pdf') {
        throw DocumentLoader.createAsyncParserRequiredError('pdf', 'pdf-parse');
      }
      if (fileExt === 'docx' || fileExt === 'doc') {
        if (fileExt === 'doc') {
          throw DocumentLoader.createLegacyDocError('sync');
        }
        throw DocumentLoader.createAsyncParserRequiredError('docx', 'mammoth');
      }
      throw DocumentLoader.createUnsupportedFileTypeError(fileExt || 'unknown', 'sync');
    } catch (e) {
      console.error(`Error loading file ${fileName}: ${String(e)}`);
      throw e;
    }
  }

  static async loadFileAsync(fileBuffer: Buffer, fileName: string): Promise<string> {
    const fileExt = DocumentLoader.getFileExtension(fileName);

    try {
      if (fileExt === 'txt' || fileExt === 'md') {
        return DocumentLoader.loadText(fileBuffer);
      }
      if (fileExt === 'pdf') {
        return await DocumentLoader.loadPdfAsync(fileBuffer);
      }
      if (fileExt === 'docx' || fileExt === 'doc') {
        if (fileExt === 'doc') {
          throw DocumentLoader.createLegacyDocError('async');
        }
        return await DocumentLoader.loadDocxAsync(fileBuffer);
      }
      throw DocumentLoader.createUnsupportedFileTypeError(fileExt || 'unknown', 'async');
    } catch (e) {
      console.error(`Error loading file ${fileName}: ${String(e)}`);
      throw e;
    }
  }

  private static getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() ?? '';
  }

  /**
   * Load text content from a buffer (txt/md files)
   */
  private static loadText(fileBuffer: Buffer): string {
    return fileBuffer.toString('utf-8');
  }

  private static createUnsupportedFileTypeError(fileType: string, mode: DocumentLoadMode): DocumentLoadError {
    return new DocumentLoadError(`Unsupported file format: ${fileType}`, {
      code: 'UNSUPPORTED_FILE_TYPE',
      fileType,
      mode,
      detail: `The .${fileType} extension is not supported for document import. Supported formats: txt, md, pdf, docx.`,
      action: 'Use a txt, md, pdf, or docx file for upload.',
    });
  }

  private static createLegacyDocError(mode: DocumentLoadMode): DocumentLoadError {
    return new DocumentLoadError('Legacy .doc format is not supported. Please convert to .docx', {
      code: 'UNSUPPORTED_LEGACY_DOC',
      fileType: 'doc',
      mode,
      detail: 'Legacy .doc files are not supported by the production import pipeline.',
      action: 'Convert the document to .docx and retry the upload.',
    });
  }

  private static createAsyncParserRequiredError(fileType: 'pdf' | 'docx', dependency: 'pdf-parse' | 'mammoth'): DocumentLoadError {
    return new DocumentLoadError(
      `${fileType.toUpperCase()} parsing requires the asynchronous document import pipeline.`,
      {
        code: 'ASYNC_PARSER_REQUIRED',
        fileType,
        mode: 'sync',
        parser: dependency,
        dependency,
        installCommand: `npm install ${dependency}`,
        detail: `${fileType.toUpperCase()} imports depend on ${dependency} and are only available through the asynchronous upload pipeline.`,
        action: 'Use the /memory/upload flow or another asynchronous ingestion path for this document type.',
      },
    );
  }

  private static createParserPrerequisiteError(fileType: 'pdf' | 'docx', dependency: 'pdf-parse' | 'mammoth'): DocumentLoadError {
    return new DocumentLoadError(
      `${dependency} is required for ${fileType.toUpperCase()} support. Install with: npm install ${dependency}`,
      {
        code: 'PARSER_PREREQUISITE_MISSING',
        fileType,
        mode: 'async',
        parser: dependency,
        dependency,
        installCommand: `npm install ${dependency}`,
        detail: `${fileType.toUpperCase()} parsing is enabled by configuration, but the required parser dependency is not installed or not loadable.`,
        action: `Install ${dependency} in the src-ts runtime environment and retry the upload.`,
      },
    );
  }

  private static createParseFailedError(
    fileType: 'pdf' | 'docx',
    dependency: 'pdf-parse' | 'mammoth',
    error: unknown,
  ): DocumentLoadError {
    const detail = error instanceof Error && error.message.trim().length > 0
      ? error.message
      : `The ${fileType.toUpperCase()} parser reported an unknown failure.`;

    return new DocumentLoadError(`Failed to parse ${fileType.toUpperCase()} file.`, {
      code: 'PARSE_FAILED',
      fileType,
      mode: 'async',
      parser: dependency,
      dependency,
      installCommand: `npm install ${dependency}`,
      detail,
      action: 'Verify the file is not corrupted and that the parser dependency is compatible with this runtime.',
    });
  }

  private static async loadPdfAsync(fileBuffer: Buffer): Promise<string> {
    let PDFParse: (new (options: { data: Buffer }) => {
      getText: () => Promise<{ text?: string }>;
      destroy?: () => Promise<void> | void;
    }) | undefined;

    try {
      const pdfParseMod = await import('pdf-parse') as {
        PDFParse?: new (options: { data: Buffer }) => {
          getText: () => Promise<{ text?: string }>;
          destroy?: () => Promise<void> | void;
        };
      };
      PDFParse = pdfParseMod.PDFParse;
    } catch {
      throw DocumentLoader.createParserPrerequisiteError('pdf', 'pdf-parse');
    }

    if (typeof PDFParse !== 'function') {
      throw DocumentLoader.createParserPrerequisiteError('pdf', 'pdf-parse');
    }

    try {
      const parser = new PDFParse({ data: fileBuffer });
      try {
        const result = await parser.getText();
        return result.text ?? '';
      } finally {
        await parser.destroy?.();
      }
    } catch (error) {
      throw DocumentLoader.createParseFailedError('pdf', 'pdf-parse', error);
    }
  }

  private static async loadDocxAsync(fileBuffer: Buffer): Promise<string> {
    let extractRawText:
      | ((options: { buffer: Buffer }) => Promise<{ value?: string }>)
      | undefined;

    try {
      const mammothMod = await import('mammoth') as {
        extractRawText?: (options: { buffer: Buffer }) => Promise<{ value?: string }>;
        default?: {
          extractRawText?: (options: { buffer: Buffer }) => Promise<{ value?: string }>;
        };
      };
      extractRawText =
        mammothMod.extractRawText ??
        mammothMod.default?.extractRawText;
    } catch {
      throw DocumentLoader.createParserPrerequisiteError('docx', 'mammoth');
    }

    if (typeof extractRawText !== 'function') {
      throw DocumentLoader.createParserPrerequisiteError('docx', 'mammoth');
    }

    try {
      const result = await extractRawText({ buffer: fileBuffer });
      return result.value ?? '';
    } catch (error) {
      throw DocumentLoader.createParseFailedError('docx', 'mammoth', error);
    }
  }
}
