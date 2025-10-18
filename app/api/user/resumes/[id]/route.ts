// app/api/user/resumes/[id]/route.ts
/**
 * API endpoints for individual resume operations
 * GET: Get signed download URL for resume
 * DELETE: Delete resume
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// GET: Get signed download URL
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const resumeId = params.id;

    // Fetch resume record (RLS ensures user owns it)
    const { data: resume, error: fetchError } = await supabase
      .from('resumes')
      .select('file_path, file_name')
      .eq('id', resumeId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !resume) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    // Generate signed URL (expires in 1 hour)
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('resumes')
      .createSignedUrl(resume.file_path, 3600); // 1 hour

    if (urlError || !urlData) {
      console.error('Failed to generate signed URL:', urlError);
      return NextResponse.json(
        { error: 'Failed to generate download link' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signed_url: urlData.signedUrl,
      file_name: resume.file_name,
      expires_in: 3600
    });

  } catch (error) {
    console.error('GET /api/user/resumes/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete resume
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const resumeId = params.id;

    // Fetch resume record to get file path (RLS ensures user owns it)
    const { data: resume, error: fetchError } = await supabase
      .from('resumes')
      .select('file_path')
      .eq('id', resumeId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !resume) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    // Delete from storage first
    const { error: storageError } = await supabase
      .storage
      .from('resumes')
      .remove([resume.file_path]);

    if (storageError) {
      console.error('Failed to delete file from storage:', storageError);
      // Continue with DB deletion even if storage deletion fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('resumes')
      .delete()
      .eq('id', resumeId)
      .eq('user_id', userId);

    if (dbError) {
      console.error('Failed to delete resume record:', dbError);
      return NextResponse.json(
        { error: 'Failed to delete resume' },
        { status: 500 }
      );
    }

    console.log('✅ Resume deleted successfully:', resumeId);

    return NextResponse.json({
      success: true,
      message: 'Resume deleted successfully'
    });

  } catch (error) {
    console.error('DELETE /api/user/resumes/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
