// lib/pdf-parser.ts
/**
 * PDF parsing utilities for resume text extraction.
 * Handles various PDF types and provides robust error handling.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface PDFParseResult {
  text: string;
  metadata?: {
    pages?: number;
    info?: any;
    version?: string;
  };
  quality: {
    textLength: number;
    readableRatio: number;
    hasStructuredContent: boolean;
  };
}

export class PDFParsingError extends Error {
  constructor(
    message: string,
    public code: 'PDF_PARSE_ERROR' | 'PDF_CORRUPTED' | 'PDF_ENCRYPTED' | 'PDF_EMPTY' | 'BUFFER_ERROR',
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PDFParsingError';
  }
}

/**
 * Extracts text from a PDF file with comprehensive error handling.
 * Optimized for Next.js serverless environment.
 */
export async function extractTextFromPDF(file: File): Promise<PDFParseResult> {
  try {
    // Validate file input
    if (!file || !(file instanceof File)) {
      throw new PDFParsingError('Invalid file input', 'BUFFER_ERROR');
    }

    // Check file size (warn for large files that might cause timeouts)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 10) {
      console.warn(`⚠️ Large PDF file detected (${fileSizeMB.toFixed(2)}MB), processing may take longer`);
    }

    // Convert File to Buffer properly for serverless environment
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate buffer
    if (buffer.length === 0) {
      throw new PDFParsingError('PDF file is empty', 'PDF_EMPTY');
    }

    // Check PDF signature
    if (!buffer.toString('ascii', 0, 4).startsWith('%PDF')) {
      throw new PDFParsingError('File does not appear to be a valid PDF', 'PDF_CORRUPTED');
    }

    console.log(`📄 Processing PDF (${fileSizeMB.toFixed(2)}MB, ${buffer.length} bytes)`);

    const data = await parsePdfWithWorker(buffer);

    if (!data.text || data.text.trim().length === 0) {
      throw new PDFParsingError('No text could be extracted from PDF', 'PDF_EMPTY');
    }

    const cleanedText = cleanExtractedText(data.text);

    // Calculate quality metrics using cleaned text for better signal
    const quality = calculateTextQuality(cleanedText, data);

    console.log(`✅ PDF parsed successfully: ${cleanedText.length} characters, ${data.numpages ?? 'unknown'} pages, quality: ${(quality.readableRatio * 100).toFixed(1)}%`);

    return {
      text: cleanedText,
      metadata: {
        pages: data.numpages,
        info: data.info,
        version: data.version
      },
      quality
    };

  } catch (error) {
    console.error('PDF parsing error:', error);

    // Handle specific pdf-parse errors
    if (error instanceof Error) {
      if (error.message.includes('password') || error.message.includes('encrypted')) {
        throw new PDFParsingError('PDF is password protected or encrypted', 'PDF_ENCRYPTED', error);
      }
      if (error.message.includes('invalid') || error.message.includes('corrupted')) {
        throw new PDFParsingError('PDF file is corrupted or invalid', 'PDF_CORRUPTED', error);
      }
      if (error.message.includes('timeout')) {
        throw new PDFParsingError('PDF processing timed out - file may be too complex', 'PDF_PARSE_ERROR', error);
      }
    }

    // Re-throw our custom errors
    if (error instanceof PDFParsingError) {
      throw error;
    }

    // Wrap unknown errors
    throw new PDFParsingError(
      `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PDF_PARSE_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

async function parsePdfWithWorker(buffer: Buffer): Promise<{
  text: string;
  numpages?: number;
  info?: any;
  version?: string;
}> {
  const workerPath = join(process.cwd(), 'scripts', 'pdf-parse-worker.cjs');

  if (!existsSync(workerPath)) {
    throw new PDFParsingError(
      'PDF worker script not found. Please ensure scripts/pdf-parse-worker.cjs exists.',
      'PDF_PARSE_ERROR'
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;

    const handleFailure = (error: Error | string) => {
      if (settled) {
        return;
      }
      settled = true;
      const message = error instanceof Error ? error.message : error;
      reject(new PDFParsingError(`PDF worker failed: ${message}`, 'PDF_PARSE_ERROR', error instanceof Error ? error : undefined));
    };

    child.stdout.on('data', chunk => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr.on('data', chunk => stderrChunks.push(Buffer.from(chunk)));
    child.on('error', handleFailure);

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      handleFailure('Timed out while parsing PDF');
    }, 20000);

    child.on('close', code => {
      clearTimeout(timeout);

      if (code !== 0) {
        const errorOutput = Buffer.concat(stderrChunks).toString('utf8').trim();
        return handleFailure(errorOutput || `Worker exited with code ${code}`);
      }

      try {
        const rawOutput = Buffer.concat(stdoutChunks).toString('utf8');
        const parsed = JSON.parse(rawOutput);
        if (settled) {
          return;
        }
        settled = true;
        resolve(parsed);
      } catch (error) {
        handleFailure(error instanceof Error ? error : new Error('Failed to parse worker output'));
      }
    });

    child.stdin.write(buffer);
    child.stdin.end();
  });
}

/**
 * Calculates quality metrics for extracted text.
 */
function calculateTextQuality(text: string, pdfData: any): PDFParseResult['quality'] {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const textLength = cleanText.length;

  // Calculate readable character ratio (non-control characters)
  const readableChars = cleanText.replace(/[\x00-\x1F\x7F-\x9F]/g, '').length;
  const readableRatio = textLength > 0 ? readableChars / textLength : 0;

  // Check for structured content that indicates good parsing
  const hasStructuredContent = (
    cleanText.includes('Experience') ||
    cleanText.includes('Education') ||
    cleanText.includes('Skills') ||
    cleanText.includes('Work') ||
    cleanText.includes('@') || // Email
    /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(cleanText) // Phone number pattern
  );

  return {
    textLength,
    readableRatio,
    hasStructuredContent
  };
}

/**
 * Cleans extracted text for better processing and database storage.
 */
function cleanExtractedText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive line breaks that break words
    .replace(/([a-zA-Z])-\s+([a-zA-Z])/g, '$1$2')
    // Fix common PDF extraction artifacts
    .replace(/\f/g, '\n\n') // Form feed to paragraph breaks
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove control characters
    // Remove null bytes and problematic Unicode
    .replace(/\u0000/g, '')
    .replace(/[\uFFFE\uFFFF]/g, '')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates if extracted text is sufficient for resume parsing.
 */
export function validateExtractedText(result: PDFParseResult): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  const { text, quality } = result;

  // Check minimum text length
  if (quality.textLength < 100) {
    issues.push(`Extracted text is too short (${quality.textLength} characters)`);
  }

  // Check readability ratio
  if (quality.readableRatio < 0.7) {
    issues.push(`Low text readability (${(quality.readableRatio * 100).toFixed(1)}% readable characters)`);
  }

  // Check for structured content
  if (!quality.hasStructuredContent) {
    issues.push('No structured resume content detected (Experience, Education, Skills, etc.)');
  }

  // Check for common parsing artifacts
  const artifactPatterns = [
    /\.{10,}/, // Many dots (likely from PDF forms)
    /\_{10,}/, // Many underscores
    /\|{5,}/,  // Many pipe characters
  ];

  for (const pattern of artifactPatterns) {
    if (pattern.test(text)) {
      issues.push('Contains PDF formatting artifacts that may affect parsing');
      break;
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Fallback text extraction for when pdf-parse fails.
 * Uses basic binary filtering as last resort.
 */
export async function fallbackPDFExtraction(file: File): Promise<string> {
  console.log('⚠️ Using fallback PDF extraction method');

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 1024 * 1024)); // Limit to 1MB

  // Aggressive cleaning for fallback method
  const cleanedText = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9\s@.-]/g, ' ') // Keep only reasonable characters
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`⚠️ Fallback extraction produced ${cleanedText.length} characters`);
  return cleanedText;
}
