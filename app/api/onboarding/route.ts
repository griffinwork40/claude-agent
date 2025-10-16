// app/api/onboarding/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { join, extname } from 'path';
import { ResumeParser, ParsedResume } from '@/lib/resume-parser';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are not set');
  }

  return createClient(supabaseUrl, supabaseKey);
}

function sanitizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const cleaned = normalized.replace(/[^\x09\x0A\x20-\x7E]/g, '');
  const trimmedLines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const result = trimmedLines.join('\n');
  return result.length > 0 ? result : undefined;
}

function sanitizePersonalInfo(personalInfo: ParsedResume['personalInfo']): ParsedResume['personalInfo'] {
  return {
    name: sanitizeText(personalInfo.name),
    email: sanitizeText(personalInfo.email),
    phone: sanitizeText(personalInfo.phone),
    location: sanitizeText(personalInfo.location),
    linkedin: sanitizeText(personalInfo.linkedin)
  };
}

function sanitizeExperience(experience: ParsedResume['experience']) {
  return experience
    .map((role) => ({
      title: sanitizeText(role.title) ?? '',
      company: sanitizeText(role.company) ?? '',
      duration: sanitizeText(role.duration) ?? '',
      description: sanitizeText(role.description) ?? ''
    }))
    .filter((role) => role.title || role.company || role.description);
}

function sanitizeSkills(skills: string[]) {
  const uniqueSkills = new Set<string>();
  for (const skill of skills) {
    const sanitized = sanitizeText(skill);
    if (sanitized) {
      uniqueSkills.add(sanitized);
    }
  }
  return Array.from(uniqueSkills).slice(0, 100);
}

type Preferences = Record<string, unknown>;

function parsePreferences(raw: unknown): Preferences | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Preferences;
      }
    } catch (error) {
      console.warn('Failed to parse preferences JSON:', error);
      return undefined;
    }
  }
  if (raw && typeof raw === 'object') {
    return raw as Preferences;
  }
  return undefined;
}

async function persistProfile(
  userId: string,
  resume: ParsedResume,
  resumeMeta: { filename: string; path: string | null },
  preferences?: Preferences
) {
  const supabase = getSupabaseAdmin();

  let resolvedPreferences: Preferences | undefined = preferences;

  if (!resolvedPreferences) {
    const { data: existingPreferencesRow, error: existingPreferencesError } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingPreferencesError && existingPreferencesRow?.preferences) {
      resolvedPreferences = existingPreferencesRow.preferences as Preferences;
    }
  }

  const profilePayload = {
    user_id: userId,
    personal_info: sanitizePersonalInfo(resume.personalInfo),
    experience: {
      positions: sanitizeExperience(resume.experience),
      skills: sanitizeSkills(resume.skills),
      raw_text: sanitizeText(resume.rawText) ?? ''
    },
    resume_path: resumeMeta.path,
    resume_filename: resumeMeta.filename,
    resume_uploaded_at: new Date().toISOString()
  };

  if (resolvedPreferences) {
    Object.assign(profilePayload, { preferences: resolvedPreferences });
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(profilePayload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('Error saving user profile:', error);
    throw new Error('Failed to persist user profile');
  }

  return data;
}

async function saveTempFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const tempFileName = `${randomUUID()}${extname(file.name).toLowerCase()}`;
  const tempPath = join(tmpdir(), tempFileName);
  await writeFile(tempPath, buffer);
  return tempPath;
}

function validateFile(file: File | null): asserts file is File {
  if (!file) {
    throw new Error('Resume file is required');
  }

  if (file.size === 0) {
    throw new Error('Uploaded file is empty');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File size exceeds 10MB limit');
  }

  const extension = extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported file extension: ${extension}`);
  }

  const mimeType = file.type || '';
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeClient.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type must be multipart/form-data' }, { status: 400 });
    }

    const formData = await request.formData();
    const resumeFile = formData.get('resume');
    const preferencesRaw = formData.get('preferences');

    if (!(resumeFile instanceof File)) {
      return NextResponse.json({ error: 'Resume file is missing or invalid' }, { status: 400 });
    }

    try {
      validateFile(resumeFile);
    } catch (validationError) {
      const message = validationError instanceof Error ? validationError.message : 'Invalid file upload';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const preferences = parsePreferences(preferencesRaw);

    const tempPath = await saveTempFile(resumeFile);

    let parsedResume: ParsedResume | null = null;

    try {
      parsedResume = await ResumeParser.parseResume(tempPath, resumeFile.name);
    } catch (parseError) {
      console.error('Resume parsing failed:', parseError);
      return NextResponse.json({ error: 'Failed to parse resume file' }, { status: 422 });
    } finally {
      await unlink(tempPath).catch((error) => {
        console.warn('Failed to remove temp resume file:', error);
      });
    }

    if (!parsedResume) {
      return NextResponse.json({ error: 'Resume parsing failed' }, { status: 500 });
    }

    const sanitizedResume = {
      ...parsedResume,
      text: sanitizeText(parsedResume.text) ?? '',
      rawText: sanitizeText(parsedResume.rawText) ?? '',
      personalInfo: sanitizePersonalInfo(parsedResume.personalInfo),
      experience: sanitizeExperience(parsedResume.experience),
      skills: sanitizeSkills(parsedResume.skills)
    };

    const profile = await persistProfile(
      session.user.id,
      sanitizedResume,
      {
        filename: resumeFile.name,
        path: null
      },
      preferences
    );

    return NextResponse.json({
      profile,
      parsedResume: sanitizedResume
    });
  } catch (error) {
    console.error('Onboarding API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
