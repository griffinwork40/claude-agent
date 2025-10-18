// app/api/user/export-profile/route.ts
/**
 * API endpoint to export user profile data as JSON.
 * Returns user_fname.json format for download or inspection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getUserDataJSON, saveUserDataAsFile } from '@/lib/user-data-compiler';

export async function GET(req: NextRequest) {
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
    const saveToFile = req.nextUrl.searchParams.get('save') === 'true';
    
    // Get user data as JSON
    const jsonData = await getUserDataJSON(userId);
    
    if (!jsonData) {
      return NextResponse.json(
        { error: 'No profile data found' },
        { status: 404 }
      );
    }
    
    // If save=true, save to file system
    if (saveToFile) {
      const filepath = await saveUserDataAsFile(userId);
      if (filepath) {
        return NextResponse.json({
          success: true,
          message: 'Profile saved to file',
          filepath
        });
      }
    }
    
    // Return JSON data
    const parsedData = JSON.parse(jsonData);
    const firstName = parsedData.personal_information.full_name.split(' ')[0] || 'user';
    const filename = `user_${firstName.toLowerCase()}.json`;
    
    return new NextResponse(jsonData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
    
  } catch (error) {
    console.error('Error exporting profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to export profile: ${errorMessage}` },
      { status: 500 }
    );
  }
}
