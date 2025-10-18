// app/api/onboarding/upload-resume/route.ts
/**
 * API endpoint for uploading and parsing resumes during onboarding.
 * Accepts PDF, DOCX, or TXT files, extracts text, and uses Claude to parse structured data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { loadMammoth, OPTIONAL_DEPENDENCY_MESSAGE } from '@/lib/mammoth-loader';
import { extractTextFromPDF, fallbackPDFExtraction, validateExtractedText, PDFParsingError } from '@/lib/pdf-parser';

// Helper to extract text from different file formats with enhanced PDF support
async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  try {
    // For plain text files
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      const text = await file.text();
      return cleanText(text);
    }

    // For PDF files - using proper pdf-parse library
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      console.log('📄 Extracting text from PDF using pdf-parse library');

      try {
        const pdfResult = await extractTextFromPDF(file);

        // Validate the extracted text quality
        const validation = validateExtractedText(pdfResult);

        if (!validation.isValid) {
          console.warn('⚠️ PDF extraction quality issues:', validation.issues);

          // If severe quality issues, try fallback
          if (validation.issues.some(issue => issue.includes('too short') || issue.includes('readability'))) {
            console.log('🔄 Trying fallback extraction due to poor quality');
            const fallbackText = await fallbackPDFExtraction(file);
            if (fallbackText.length > pdfResult.text.length) {
              console.log('✓ Fallback extraction provided better results');
              return cleanText(fallbackText);
            }
          }
        }

        console.log(`✅ High-quality PDF extraction: ${pdfResult.text.length} characters, ${pdfResult.metadata?.pages || 'unknown'} pages`);
        return pdfResult.text;

      } catch (pdfError) {
        if (pdfError instanceof PDFParsingError) {
          console.error(`PDF parsing failed (${pdfError.code}): ${pdfError.message}`);

          // Try fallback for recoverable errors
          if (pdfError.code === 'PDF_PARSE_ERROR' || pdfError.code === 'PDF_CORRUPTED') {
            console.log('🔄 Attempting fallback extraction');
            try {
              const fallbackText = await fallbackPDFExtraction(file);
              if (fallbackText.length > 50) { // Only use if we get something meaningful
                console.log(`✓ Fallback extraction succeeded: ${fallbackText.length} characters`);
                return cleanText(fallbackText);
              }
            } catch (fallbackError) {
              console.error('Fallback extraction also failed:', fallbackError);
            }
          }

          // Re-throw the original error with context
          throw new Error(`PDF parsing failed: ${pdfError.message}. Please ensure your PDF is not password-protected or corrupted.`);
        }

        // Handle unexpected errors
        throw pdfError;
      }
    }

    // For DOCX files
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
      try {
        const buffer = await file.arrayBuffer();
        const mammoth = await loadMammoth();
        const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        console.log(`✓ Extracted ${result.value.length} characters from DOCX`);
        return cleanText(result.value);
      } catch (mammothError) {
        if (mammothError instanceof Error && mammothError.message === OPTIONAL_DEPENDENCY_MESSAGE) {
          throw new Error('DOCX parsing is currently unavailable. Please install the optional mammoth dependency or upload a PDF/TXT file.');
        }
        throw mammothError;
      }
    }

    // Fallback for other file types - try to read as text
    console.log(`⚠️ Unknown file type ${fileType}, attempting text extraction`);
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    return cleanText(text);

  } catch (error) {
    console.error('Error extracting text from file:', error);

    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes('PDF parsing failed')) {
        throw error; // Re-throw our custom PDF errors
      }
      if (error.message.includes('password') || error.message.includes('encrypted')) {
        throw new Error('PDF file is password-protected. Please remove password protection and try again.');
      }
      if (error.message.includes('corrupted')) {
        throw new Error('PDF file appears to be corrupted. Please try a different file or save the PDF again.');
      }
    }

    throw new Error(`Failed to extract text from ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Enhanced text cleaning for better resume parsing and database storage
function cleanText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Remove null bytes and problematic Unicode characters
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\uFFFE\uFFFF]/g, '')
    // Normalize whitespace while preserving structure
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive line breaks
    .replace(/[ \t]{2,}/g, ' ') // Limit consecutive spaces/tabs
    // Fix common PDF extraction artifacts
    .replace(/([a-zA-Z])-\s+([a-zA-Z])/g, '$1$2') // Fix hyphenated words
    .replace(/\f/g, '\n\n') // Form feeds to paragraph breaks
    // Remove excessive punctuation that might indicate formatting issues
    .replace(/={5,}/g, '') // Remove long equal signs
    .replace(/-{5,}/g, '') // Remove long dashes
    .replace(/\.{5,}/g, '') // Remove long dots
    // Clean up edges
    .trim();
}

// Enhanced resume parsing with validation and better error handling
async function parseResumeWithClaude(resumeText: string): Promise<any> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // Validate input text
  if (!resumeText || typeof resumeText !== 'string') {
    throw new Error('Invalid resume text provided');
  }

  if (resumeText.trim().length === 0) {
    throw new Error('Resume text is empty - no content to parse');
  }

  // Check if text is too short to be meaningful
  if (resumeText.trim().length < 50) {
    console.warn(`Resume text is very short (${resumeText.length} characters), parsing may be limited`);
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Truncate resume text to avoid token limits (approx 100,000 characters ~ 25,000 tokens)
  const maxResumeLength = 100000;
  const truncatedResumeText = resumeText.length > maxResumeLength
    ? resumeText.substring(0, maxResumeLength) + "\n\n[Note: Resume was truncated due to length]"
    : resumeText;

  const prompt = `You are a resume parser. Extract structured information from the following resume text and return it as JSON.

IMPORTANT: Look for work experience under sections like "WORK EXPERIENCE", "PROFESSIONAL EXPERIENCE", "EMPLOYMENT HISTORY", "CAREER HISTORY", or similar.

Extract the following fields:
- personal_info: { name, email, phone, location }
- experience: { 
    skills (array), 
    years_experience (number - calculate from work history), 
    previous_roles (array of {title, company, duration, description}) 
  }
- education: array of { degree, institution, year, field }
- summary: brief professional summary (2-3 sentences)

For previous_roles, extract each job as:
- title: job title/position (e.g., "Software Engineer", "Senior Developer")
- company: company/employer name (e.g., "Google", "Microsoft")
- duration: time period (e.g., "2023-2024", "Jan 2023 - Dec 2024", "2 years")
- description: key responsibilities and achievements (1-2 sentences)

Example JSON structure:
{
  "personal_info": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1-555-123-4567",
    "location": "San Francisco, CA"
  },
  "experience": {
    "skills": ["JavaScript", "React", "Node.js"],
    "years_experience": 5,
    "previous_roles": [
      {
        "title": "Senior Software Engineer",
        "company": "Tech Corp",
        "duration": "2020-2024",
        "description": "Led development of web applications using React and Node.js"
      }
    ]
  },
  "education": [
    {
      "degree": "Bachelor of Science",
      "institution": "University of California",
      "year": "2018",
      "field": "Computer Science"
    }
  ],
  "summary": "Experienced software engineer with 5+ years in full-stack development."
}

Resume text:
${truncatedResumeText}

Return ONLY valid JSON with the structure above. If any field is not found, use empty string, empty array, or 0 as appropriate.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      { role: 'user', content: prompt }
    ]
  });
  
  const contentBlock = response.content[0];
  if (contentBlock.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  
  const jsonText = contentBlock.text.trim();
  // Extract JSON from markdown code blocks if present
  const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  const cleanedJson = jsonMatch ? jsonMatch[1] : jsonText;
  
  return JSON.parse(cleanedJson);
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('resume') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = ['.pdf', '.txt', '.docx'];
    const hasValidType = allowedTypes.includes(file.type) || allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!hasValidType) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PDF, DOCX, or TXT file.' },
        { status: 400 }
      );
    }
    
    console.log(`📄 Processing resume upload for user ${userId}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    // Extract text from file with enhanced error handling
    let resumeText: string;
    try {
      resumeText = await extractTextFromFile(file);
      console.log(`✓ Extracted ${resumeText.length} characters from ${file.name}`);

      // Validate extracted text quality
      if (resumeText.length < 100) {
        console.warn(`⚠️ Extracted text is very short (${resumeText.length} characters), resume may be image-based or corrupted`);
      }

    } catch (extractionError) {
      console.error('❌ Text extraction failed:', extractionError);
      return NextResponse.json(
        { error: extractionError instanceof Error ? extractionError.message : 'Failed to extract text from resume file' },
        { status: 400 }
      );
    }

    // Parse resume with Claude
    let parsedData: any;
    try {
      console.log('🤖 Parsing resume with Claude...');
      parsedData = await parseResumeWithClaude(resumeText);
      console.log('✓ Resume parsed successfully:', {
        personalInfoFound: !!parsedData.personal_info?.name,
        experienceCount: parsedData.experience?.previous_roles?.length || 0,
        educationCount: parsedData.education?.length || 0,
        skillsCount: parsedData.experience?.skills?.length || 0
      });

    } catch (parsingError) {
      console.error('❌ Resume parsing failed:', parsingError);
      return NextResponse.json(
        { error: parsingError instanceof Error ? parsingError.message : 'Failed to parse resume data' },
        { status: 500 }
      );
    }
    
    // Store resume and parsed data in user_profiles
    const { data: profile, error: upsertError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        personal_info: parsedData.personal_info || {},
        experience: parsedData.experience || { skills: [], years_experience: 0, previous_roles: [] },
        education: parsedData.education || [],
        summary: parsedData.summary || '',
        preferences: {
          job_types: [],
          locations: [],
          salary_range: { min: 0, max: 0 },
          remote_work: true
        }, // Default preferences to satisfy NOT NULL constraint
        resume_text: resumeText,
        resume_path: file.name
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();
    
    if (upsertError) {
      console.error('Error saving profile:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save profile data' },
        { status: 500 }
      );
    }
    
    console.log('✓ Profile data saved to database');
    
    return NextResponse.json({
      success: true,
      data: {
        personal_info: parsedData.personal_info,
        experience: parsedData.experience,
        education: parsedData.education,
        summary: parsedData.summary
      }
    });
    
  } catch (error) {
    console.error('Error in upload-resume endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to process resume: ${errorMessage}` },
      { status: 500 }
    );
  }
}
