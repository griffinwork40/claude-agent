// lib/pdf-parser.test.ts
/**
 * Tests for PDF text extraction and validation utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  extractTextFromPDF, 
  validateExtractedText, 
  fallbackPDFExtraction,
  PDFParsingError 
} from './pdf-parser';

// Mock child_process
const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: mockSpawn
}));

// Mock fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn()
}));

// Mock path
vi.mock('node:path', () => ({
  join: vi.fn((...args) => args.join('/'))
}));

describe('PDF Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to worker script existing
    const { existsSync } = require('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
  });

  describe('extractTextFromPDF', () => {
    it('should extract text from valid PDF', async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        stdin: { write: vi.fn(), end: vi.fn() },
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockChild);

      // Mock successful worker output
      const mockOutput = JSON.stringify({
        text: 'John Doe\nSoftware Engineer\njohn@example.com\nExperience: 5 years',
        numpages: 1,
        info: { Title: 'Resume' },
        version: '1.0'
      });

      const mockStdoutChunks = [Buffer.from(mockOutput)];
      mockChild.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(mockOutput)), 10);
        }
      });

      mockChild.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 20);
        }
      });

      const pdfFile = new File(['PDF content'], 'resume.pdf', { type: 'application/pdf' });
      const result = await extractTextFromPDF(pdfFile);

      expect(result.text).toContain('John Doe');
      expect(result.metadata?.pages).toBe(1);
      expect(result.quality.textLength).toBeGreaterThan(0);
      expect(result.quality.readableRatio).toBeGreaterThan(0);
    });

    it('should handle invalid file input', async () => {
      await expect(extractTextFromPDF(null as any)).rejects.toThrow('Invalid file input');
      await expect(extractTextFromPDF(undefined as any)).rejects.toThrow('Invalid file input');
    });

    it('should handle empty PDF files', async () => {
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      await expect(extractTextFromPDF(emptyFile)).rejects.toThrow('PDF file is empty');
    });

    it('should handle non-PDF files', async () => {
      const nonPdfFile = new File(['Not a PDF'], 'document.txt', { type: 'text/plain' });
      await expect(extractTextFromPDF(nonPdfFile)).rejects.toThrow('File does not appear to be a valid PDF');
    });

    it('should handle worker script not found', async () => {
      const { existsSync } = require('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const pdfFile = new File(['PDF content'], 'resume.pdf', { type: 'application/pdf' });
      await expect(extractTextFromPDF(pdfFile)).rejects.toThrow('PDF worker script not found');
    });

    it('should handle worker process errors', async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        stdin: { write: vi.fn(), end: vi.fn() },
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockChild);

      mockChild.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10); // Non-zero exit code
        }
      });

      mockChild.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('Worker error')), 5);
        }
      });

      const pdfFile = new File(['PDF content'], 'resume.pdf', { type: 'application/pdf' });
      await expect(extractTextFromPDF(pdfFile)).rejects.toThrow('PDF worker failed');
    });

    it('should handle worker timeout', async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        stdin: { write: vi.fn(), end: vi.fn() },
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockChild);

      // Don't trigger close event to simulate timeout
      mockChild.on.mockImplementation(() => {});

      const pdfFile = new File(['PDF content'], 'resume.pdf', { type: 'application/pdf' });
      await expect(extractTextFromPDF(pdfFile)).rejects.toThrow('Timed out while parsing PDF');
    });

    it('should handle worker output parsing errors', async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        stdin: { write: vi.fn(), end: vi.fn() },
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockChild);

      // Mock invalid JSON output
      mockChild.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('Invalid JSON')), 10);
        }
      });

      mockChild.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 20);
        }
      });

      const pdfFile = new File(['PDF content'], 'resume.pdf', { type: 'application/pdf' });
      await expect(extractTextFromPDF(pdfFile)).rejects.toThrow('PDF worker failed');
    });

    it('should handle encrypted PDFs', async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        stdin: { write: vi.fn(), end: vi.fn() },
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockChild);

      mockChild.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('PDF is password protected')), 5);
        }
      });

      mockChild.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10);
        }
      });

      const pdfFile = new File(['encrypted PDF'], 'resume.pdf', { type: 'application/pdf' });
      await expect(extractTextFromPDF(pdfFile)).rejects.toThrow('PDF is password protected or encrypted');
    });

    it('should handle corrupted PDFs', async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        stdin: { write: vi.fn(), end: vi.fn() },
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockChild);

      mockChild.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('PDF is corrupted')), 5);
        }
      });

      mockChild.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10);
        }
      });

      const pdfFile = new File(['corrupted PDF'], 'resume.pdf', { type: 'application/pdf' });
      await expect(extractTextFromPDF(pdfFile)).rejects.toThrow('PDF file is corrupted or invalid');
    });

    it('should handle large files with warning', async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        stdin: { write: vi.fn(), end: vi.fn() },
        kill: vi.fn()
      };

      mockSpawn.mockReturnValue(mockChild);

      const mockOutput = JSON.stringify({
        text: 'Large PDF content',
        numpages: 10,
        info: {},
        version: '1.0'
      });

      mockChild.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(mockOutput)), 10);
        }
      });

      mockChild.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 20);
        }
      });

      // Create a large file (11MB)
      const largeContent = 'x'.repeat(11 * 1024 * 1024);
      const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await extractTextFromPDF(largeFile);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Large PDF file detected')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('validateExtractedText', () => {
    it('should validate good quality text', () => {
      const goodResult = {
        text: 'John Doe\nSoftware Engineer\njohn@example.com\nExperience: 5 years\nSkills: JavaScript, React, Node.js',
        quality: {
          textLength: 100,
          readableRatio: 0.95,
          hasStructuredContent: true
        }
      };

      const validation = validateExtractedText(goodResult);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should flag text that is too short', () => {
      const shortResult = {
        text: 'John',
        quality: {
          textLength: 4,
          readableRatio: 1.0,
          hasStructuredContent: false
        }
      };

      const validation = validateExtractedText(shortResult);
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Extracted text is too short (4 characters)');
    });

    it('should flag low readability ratio', () => {
      const lowQualityResult = {
        text: 'John Doe\nSoftware Engineer',
        quality: {
          textLength: 50,
          readableRatio: 0.5,
          hasStructuredContent: true
        }
      };

      const validation = validateExtractedText(lowQualityResult);
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Low text readability (50.0% readable characters)');
    });

    it('should flag missing structured content', () => {
      const unstructuredResult = {
        text: 'This is just random text without any resume structure',
        quality: {
          textLength: 100,
          readableRatio: 0.9,
          hasStructuredContent: false
        }
      };

      const validation = validateExtractedText(unstructuredResult);
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('No structured resume content detected (Experience, Education, Skills, etc.)');
    });

    it('should flag PDF formatting artifacts', () => {
      const artifactResult = {
        text: 'John Doe\nSoftware Engineer\n..............\nExperience',
        quality: {
          textLength: 100,
          readableRatio: 0.9,
          hasStructuredContent: true
        }
      };

      const validation = validateExtractedText(artifactResult);
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Contains PDF formatting artifacts that may affect parsing');
    });

    it('should handle multiple issues', () => {
      const badResult = {
        text: 'Jo',
        quality: {
          textLength: 2,
          readableRatio: 0.3,
          hasStructuredContent: false
        }
      };

      const validation = validateExtractedText(badResult);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(1);
    });
  });

  describe('fallbackPDFExtraction', () => {
    it('should extract text using fallback method', async () => {
      const pdfFile = new File(['PDF content with some text'], 'resume.pdf', { type: 'application/pdf' });
      const result = await fallbackPDFExtraction(pdfFile);

      expect(result).toContain('PDF content');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty files', async () => {
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      const result = await fallbackPDFExtraction(emptyFile);

      expect(result).toBe('');
    });

    it('should limit extraction to 1MB', async () => {
      // Create a large file (2MB)
      const largeContent = 'x'.repeat(2 * 1024 * 1024);
      const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' });
      
      const result = await fallbackPDFExtraction(largeFile);
      
      // Should be limited to 1MB
      expect(result.length).toBeLessThanOrEqual(1024 * 1024);
    });

    it('should clean extracted text', async () => {
      const pdfFile = new File(['John\x00Doe\nSoftware\x01Engineer'], 'resume.pdf', { type: 'application/pdf' });
      const result = await fallbackPDFExtraction(pdfFile);

      // Should remove control characters
      expect(result).not.toContain('\x00');
      expect(result).not.toContain('\x01');
      expect(result).toContain('John');
      expect(result).toContain('Doe');
    });
  });

  describe('PDFParsingError', () => {
    it('should create error with code', () => {
      const error = new PDFParsingError('Test error', 'PDF_CORRUPTED');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('PDF_CORRUPTED');
      expect(error.name).toBe('PDFParsingError');
    });

    it('should include original error', () => {
      const originalError = new Error('Original error');
      const error = new PDFParsingError('Test error', 'PDF_PARSE_ERROR', originalError);
      
      expect(error.originalError).toBe(originalError);
    });
  });
});
