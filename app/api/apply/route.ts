// app/api/apply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { JobOpportunity } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { jobId, userId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Get the job details from the database
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('Error fetching job:', jobError);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Trigger the Playwright automation to apply for the job
    // This would call our Playwright function
    const applicationResult = await submitApplication(job);

    // Save application result to the database
    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .insert([{
        job_id: jobId,
        user_id: userId,
        status: applicationResult.success ? 'submitted' : 'failed',
        result: applicationResult,
        applied_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (applicationError) {
      console.error('Error saving application:', applicationError);
      return NextResponse.json({ error: 'Failed to save application' }, { status: 500 });
    }

    // Update job status to indicate it's been applied to
    await supabase
      .from('jobs')
      .update({ applied: true, applied_at: new Date().toISOString() })
      .eq('id', jobId);

    return NextResponse.json({ 
      success: true, 
      application: application,
      message: applicationResult.message
    });
  } catch (error) {
    console.error('Error in apply API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { getPlaywrightService } from '@/lib/playwright-service';
import { readFileSync } from 'fs';

// Function to submit application using Playwright
async function submitApplication(job: any) {
  try {
    // Get profile data from griffin.json
    const profileData = JSON.parse(
      readFileSync('/Users/griffinlong/Projects/personal_projects/resume/griffin.json', 'utf8')
    );
    
    // Get resume path from profile data
    const resumePath = profileData.resume_location;
    
    // Initialize Playwright service
    const playwrightService = getPlaywrightService();
    await playwrightService.initialize();
    
    // Prepare application data
    const applicationData = {
      url: job.application_url,
      profileData,
      resumePath
    };
    
    // Submit the application
    const result = await playwrightService.submitApplication(applicationData);
    
    // Close the Playwright service after use
    await playwrightService.close();
    
    return result;
  } catch (error: any) {
    console.error('Error submitting application:', error);
    return {
      success: false,
      message: `Failed to apply to ${job.title} at ${job.company}: ${error.message}`,
      error: error.message
    };
  }
}