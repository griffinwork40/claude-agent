// app/api/onboarding/upload-resume/route.test.ts
/**
 * Tests for resume upload and parsing endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn()
  },
  from: vi.fn(() => ({
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => 
          Promise.resolve({ 
            data: { id: 'test-profile-id' } as any, 
            error: null as any
          })
        )
      }))
    }))
  }))
};

vi.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: vi.fn(() => mockSupabaseClient)
}));

// Mock Anthropic
const mockAnthropic = {
  messages: {
    create: vi.fn()
  }
};

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => mockAnthropic)
}));

// Mock mammoth loader for DOCX parsing
const mockExtractRawText = vi.fn();
const mockLoadMammoth = vi.fn(async () => ({ extractRawText: mockExtractRawText }));

vi.mock('@/lib/mammoth-loader', () => ({
  loadMammoth: mockLoadMammoth,
  OPTIONAL_DEPENDENCY_MESSAGE: 'DOCX parsing requires the optional dependency "mammoth". Install it to enable DOCX uploads.',
}));

// Mock PDF parser
vi.mock('@/lib/pdf-parser', () => ({
  extractTextFromPDF: vi.fn(),
  fallbackPDFExtraction: vi.fn(),
  validateExtractedText: vi.fn(),
  PDFParsingError: class PDFParsingError extends Error {
    constructor(message: string, public code: string) {
      super(message);
    }
  }
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({}))
}));

describe('Resume Upload API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to authenticated session
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user-id' } } }
    });
    mockLoadMammoth.mockResolvedValue({ extractRawText: mockExtractRawText });
    mockExtractRawText.mockReset();
  });

  it('should reject requests without authentication', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null }
    });

    const formData = new FormData();
    formData.append('resume', new File(['test content'], 'test.pdf', { type: 'application/pdf' }));

    const request = new NextRequest('http://localhost:3000/api/onboarding/upload-resume', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should reject requests without file', async () => {
    const formData = new FormData();
    const request = new NextRequest('http://localhost:3000/api/onboarding/upload-resume', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No file uploaded');
  });

  it('should reject files that are too large', async () => {
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('resume', largeFile);

    const request = new NextRequest('http://localhost:3000/api/onboarding/upload-resume', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('File size must be less than 5MB');
  });

  it('should reject invalid file types', async () => {
    const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-executable' });
    const formData = new FormData();
    formData.append('resume', invalidFile);

    const request = new NextRequest('http://localhost:3000/api/onboarding/upload-resume', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid file type. Please upload PDF, DOCX, or TXT file.');
  });

  it('should successfully parse and save PDF resume data', async () => {
    const { extractTextFromPDF, validateExtractedText } = await import('@/lib/pdf-parser');
    
    // Mock PDF extraction
    vi.mocked(extractTextFromPDF).mockResolvedValue({
      text: 'John Doe\nSoftware Engineer\njohn@example.com\nExperience: 5 years',
      metadata: { pages: 1 },
      quality: { textLength: 50, readableRatio: 0.9, hasStructuredContent: true }
    });
    
    vi.mocked(validateExtractedText).mockReturnValue({
      isValid: true,
      issues: []
    });

    // Mock Claude response
    mockAnthropic.messages.create.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          personal_info: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '123-456-7890',
            location: 'San Francisco, CA'
          },
          experience: {
            skills: ['JavaScript', 'React', 'Node.js'],
            years_experience: 5,
            previous_roles: [
              {
                title: 'Software Engineer',
                company: 'Tech Corp',
                duration: '2020-2025',
                description: 'Full-stack development'
              }
            ]
          },
          education: [],
          summary: 'Experienced software engineer'
        })
      }]
    });

    const pdfFile = new File(['PDF content'], 'resume.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('resume', pdfFile);

    const request = new NextRequest('http://localhost:3000/api/onboarding/upload-resume', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.personal_info.name).toBe('John Doe');
    expect(data.data.experience.skills).toEqual(['JavaScript', 'React', 'Node.js']);
    
    // Verify database upsert was called
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_profiles');
  });

  it('should handle DOCX files', async () => {
    mockExtractRawText.mockResolvedValue({
      value: 'Jane Smith\nSenior Developer\njane@example.com',
      messages: []
    });

    mockAnthropic.messages.create.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          personal_info: { name: 'Jane Smith', email: 'jane@example.com', phone: '', location: '' },
          experience: { skills: [], years_experience: 0, previous_roles: [] },
          education: [],
          summary: ''
        })
      }]
    });

    const docxFile = new File(['DOCX content'], 'resume.docx', { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    const formData = new FormData();
    formData.append('resume', docxFile);

    const request = new NextRequest('http://localhost:3000/api/onboarding/upload-resume', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockExtractRawText).toHaveBeenCalled();
  });

  it('should handle TXT files', async () => {
    mockAnthropic.messages.create.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          personal_info: { name: 'Bob Wilson', email: 'bob@example.com', phone: '', location: '' },
          experience: { skills: [], years_experience: 0, previous_roles: [] },
          education: [],
          summary: ''
        })
      }]
    });

    const txtFile = new File(['Plain text resume content'], 'resume.txt', { type: 'text/plain' });
    const formData = new FormData();
    formData.append('resume', txtFile);

    const request = new NextRequest('http://localhost:3000/api/onboarding/upload-resume', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should handle PDF parsing errors gracefully', async () => {
    const { extractTextFromPDF, PDFParsingError } = await import('@/lib/pdf-parser');
    
    vi.mocked(extractTextFromPDF).mockRejectedValue(
      new PDFParsingError('PDF is encrypted', 'PDF_ENCRYPTED')
    );

    const pdfFile = new File(['encrypted PDF'], 'resume.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('resume', pdfFile);

    const request = new NextRequest('http://localhost:3000/api/onboarding/upload-resume', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('PDF parsing failed');
  });

  it('should handle Claude parsing errors', async () => {
    const { extractTextFromPDF } = await import('@/lib/pdf-parser');
    
    vi.mocked(extractTextFromPDF).mockResolvedValue({
      text: 'Valid resume text',
      metadata: { pages: 1 },
      quality: { textLength: 50, readableRatio: 0.9, hasStructuredContent: true }
    });

    mockAnthropic.messages.create.mockRejectedValue(new Error('Claude API error'));

    const pdfFile = new File(['PDF content'], 'resume.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('resume', pdfFile);

    const request = new NextRequest('http://localhost:3000/api/onboarding/upload-resume', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Failed to parse resume data');
  });

  it('should handle database save errors', async () => {
    const { extractTextFromPDF } = await import('@/lib/pdf-parser');
    
    vi.mocked(extractTextFromPDF).mockResolvedValue({
      text: 'Valid resume text',
      metadata: { pages: 1 },
      quality: { textLength: 50, readableRatio: 0.9, hasStructuredContent: true }
    });

    mockAnthropic.messages.create.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          personal_info: { name: 'Test User', email: 'test@example.com', phone: '', location: '' },
          experience: { skills: [], years_experience: 0, previous_roles: [] },
          education: [],
          summary: ''
        })
      }]
    });

    // Mock database error
    mockSupabaseClient.from().upsert().select().single.mockResolvedValue({
      data: null,
      error: { message: 'Database error' }
    });

    const pdfFile = new File(['PDF content'], 'resume.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('resume', pdfFile);

    const request = new NextRequest('http://localhost:3000/api/onboarding/upload-resume', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to save profile data');
  });
});
