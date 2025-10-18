// app/api/user/resumes/route.ts
/**
 * API endpoints for managing user resumes in dashboard
 * GET: List all user's resumes
 * POST: Upload new resume
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { loadMammoth, OPTIONAL_DEPENDENCY_MESSAGE } from '@/lib/mammoth-loader';
import { extractTextFromPDF, validateExtractedText, fallbackPDFExtraction } from '@/lib/pdf-parser';

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'text/plain'
];

// Helper to extract text from different file formats
async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  try {
    // Plain text
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      const text = await file.text();
      return cleanText(text);
    }

    // PDF files
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      console.log('📄 Extracting text from PDF');
      
      try {
        const pdfResult = await extractTextFromPDF(file);
        const validation = validateExtractedText(pdfResult);

        if (!validation.isValid) {
          console.warn('⚠️ PDF extraction quality issues:', validation.issues);
          
          // Try fallback if quality is poor
          if (validation.issues.some(issue => issue.includes('too short') || issue.includes('readability'))) {
            console.log('🔄 Trying fallback extraction');
            const fallbackText = await fallbackPDFExtraction(file);
            if (fallbackText.length > pdfResult.text.length) {
              console.log('✓ Fallback extraction provided better results');
              return cleanText(fallbackText);
            }
          }
        }

        return cleanText(pdfResult.text);
      } catch (error) {
        console.error('PDF extraction failed:', error);
        throw new Error('Failed to extract text from PDF');
      }
    }

    // DOCX files
    if (fileType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
      console.log('📄 Extracting text from DOCX');
      try {
        const arrayBuffer = await file.arrayBuffer();
        const mammoth = await loadMammoth();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return cleanText(result.value);
      } catch (mammothError) {
        if (mammothError instanceof Error && mammothError.message === OPTIONAL_DEPENDENCY_MESSAGE) {
          throw new Error('DOCX parsing is currently disabled because the optional mammoth dependency is not installed.');
        }
        throw mammothError;
      }
    }

    throw new Error('Unsupported file type');
  } catch (error) {
    console.error('Text extraction error:', error);
    throw error;
  }
}

// Helper to clean extracted text
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// GET: List all user's resumes
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication - use getUser() for proper auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Fetch all resumes for the user
    const { data: resumes, error: fetchError } = await supabase
      .from('resumes')
      .select('id, file_name, file_path, file_size, created_at, updated_at, resume_text')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching resumes:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch resumes' },
        { status: 500 }
      );
    }

    // Format response with preview text
    const formattedResumes = (resumes || []).map(resume => ({
      id: resume.id,
      file_name: resume.file_name,
      file_size: resume.file_size,
      created_at: resume.created_at,
      updated_at: resume.updated_at,
      preview_text: resume.resume_text 
        ? resume.resume_text.substring(0, 100) + (resume.resume_text.length > 100 ? '...' : '')
        : null,
    }));

    return NextResponse.json({
      resumes: formattedResumes,
      count: formattedResumes.length
    });

  } catch (error) {
    console.error('GET /api/user/resumes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Upload new resume
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication - use getUser() for proper auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PDF, DOCX, or TXT file' },
        { status: 400 }
      );
    }

    console.log(`📤 Uploading resume: ${file.name} (${file.size} bytes)`);

    // Extract text from file
    let resumeText: string;
    try {
      resumeText = await extractTextFromFile(file);
      console.log(`✅ Extracted ${resumeText.length} characters from resume`);
    } catch (error) {
      console.error('Failed to extract text:', error);
      return NextResponse.json(
        { error: 'Failed to parse resume file' },
        { status: 400 }
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${userId}/${timestamp}_${sanitizedFileName}`;
    
    console.log(`📁 File path: ${filePath}`);
    console.log(`👤 User ID: ${userId}`);

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase
      .storage
      .from('resumes')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      
      // Check if bucket doesn't exist
      if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
        return NextResponse.json(
          { error: 'Storage bucket "resumes" not found. Please create it in Supabase Dashboard (Storage > New Bucket > name: "resumes", set to Private)' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to upload file to storage: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Insert resume record into database
    const { data: resume, error: dbError } = await supabase
      .from('resumes')
      .insert({
        user_id: userId,
        file_name: file.name,
        file_path: filePath,
        resume_text: resumeText,
        file_size: file.size
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      
      // Clean up uploaded file if DB insert fails
      await supabase.storage.from('resumes').remove([filePath]);
      
      return NextResponse.json(
        { error: 'Failed to save resume record' },
        { status: 500 }
      );
    }

    console.log('✅ Resume uploaded successfully:', resume.id);

    return NextResponse.json({
      success: true,
      resume: {
        id: resume.id,
        file_name: resume.file_name,
        file_size: resume.file_size,
        created_at: resume.created_at,
        preview_text: resumeText.substring(0, 100) + (resumeText.length > 100 ? '...' : '')
      }
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/user/resumes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
