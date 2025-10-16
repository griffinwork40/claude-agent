// app/api/onboarding/upload-resume/route.ts
/**
 * API endpoint for uploading and parsing resumes during onboarding.
 * Accepts PDF, DOCX, or TXT files, extracts text, and uses Claude to parse structured data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

// Helper to extract text from different file formats
async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  // For plain text files
  if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
    return await file.text();
  }
  
  // For PDF and DOCX, we'll just extract text content
  // In production, you'd use libraries like pdf-parse or mammoth
  // For now, we'll read as text and let Claude extract what it can
  const buffer = await file.arrayBuffer();
  const text = new TextDecoder().decode(buffer);
  
  return text;
}

// Parse resume using Claude
async function parseResumeWithClaude(resumeText: string): Promise<any> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  
  const prompt = `You are a resume parser. Extract structured information from the following resume text and return it as JSON.

Extract the following fields:
- personal_info: { name, email, phone, location }
- experience: { skills (array), years_experience (number), previous_roles (array of {title, company, duration, description}) }
- education: array of { degree, institution, year, field }
- summary: brief professional summary (2-3 sentences)

Resume text:
${resumeText}

Return ONLY valid JSON with the structure above. If any field is not found, use empty string, empty array, or 0 as appropriate.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
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
    
    console.log(`📄 Processing resume upload for user ${userId}: ${file.name}`);
    
    // Extract text from file
    const resumeText = await extractTextFromFile(file);
    console.log(`✓ Extracted ${resumeText.length} characters from resume`);
    
    // Parse resume with Claude
    console.log('🤖 Parsing resume with Claude...');
    const parsedData = await parseResumeWithClaude(resumeText);
    console.log('✓ Resume parsed successfully:', parsedData);
    
    // Store resume and parsed data in user_profiles
    const { data: profile, error: upsertError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        personal_info: parsedData.personal_info || {},
        experience: parsedData.experience || { skills: [], years_experience: 0, previous_roles: [] },
        resume_text: resumeText,
        resume_path: file.name,
        updated_at: new Date().toISOString()
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
