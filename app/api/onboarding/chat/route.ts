// app/api/onboarding/chat/route.ts
/**
 * Onboarding chat endpoint - streaming SSE for conversational data collection.
 * Uses Claude to ask follow-up questions and complete user profile.
 */

import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

const ONBOARDING_SYSTEM_PROMPT = `You are a friendly onboarding assistant helping users set up their job search profile.

Your goal is to collect and confirm the following information:
1. Personal Information: name, email, phone, location
2. Skills: technical skills, soft skills, certifications
3. Experience: years of experience, previous roles/companies
4. Education: degrees, institutions, graduation years
5. Job Preferences: desired roles, locations, salary range, remote work preference

The user has already uploaded their resume, and we have extracted some initial data. Your job is to:
- Review the extracted data with the user
- Ask clarifying questions about missing or unclear information
- If work experience (previous_roles) is empty, ask the user directly about their work history
- Help them refine their job preferences
- Be conversational, friendly, and efficient
- Once all information is confirmed, say "Great! Your profile is complete. Let's get started!" and the system will mark onboarding as complete.

Keep responses concise (2-3 sentences max). Ask one question at a time.

Current user data:
{USER_DATA}

If any fields above are empty or incomplete, reference the resume excerpt below to infer missing details before asking follow-up questions. Confirm anything you infer with the user.

Resume excerpt (use to fill gaps when needed):
{RESUME_TEXT}

If the user says they're done or everything looks good, confirm completion.`;

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    const body = await req.json();
    const { message, sessionId } = body;
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400 }
      );
    }
    
    console.log('🎯 Onboarding chat request:', { userId, message: message.substring(0, 50) });
    
    // Get user profile data
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    // Get or create conversation session
    const conversationKey = sessionId || `onboarding_${userId}`;

    const { data: storedMessages, error: loadError } = await supabase
      .from('onboarding_chat_messages')
      .select('role, content')
      .eq('user_id', userId)
      .eq('session_id', conversationKey)
      .order('created_at', { ascending: true });

    if (loadError) {
      console.error('Failed to load onboarding chat history:', loadError);
      return new Response(
        JSON.stringify({ error: 'Unable to load chat history' }),
        { status: 500 }
      );
    }

    const messages = storedMessages?.map(({ role, content }) => ({ role, content })) ?? [];

    // Add user message
    messages.push({ role: 'user', content: message });

    const { error: insertUserMessageError } = await supabase
      .from('onboarding_chat_messages')
      .insert({
        user_id: userId,
        session_id: conversationKey,
        role: 'user',
        content: message
      });

    if (insertUserMessageError) {
      console.error('Failed to store onboarding chat user message:', insertUserMessageError);
      return new Response(
        JSON.stringify({ error: 'Unable to store user message' }),
        { status: 500 }
      );
    }
    
    // Prepare system prompt with user data
    const userData = profile ? JSON.stringify({
      personal_info: profile.personal_info,
      experience: profile.experience,
      education: profile.education,
      summary: profile.summary,
      preferences: profile.preferences
    }, null, 2) : 'No data collected yet';
    
    const resumeText =
      profile && typeof profile.resume_text === 'string' && profile.resume_text.trim().length > 0
        ? profile.resume_text.trim().slice(0, 4000)
        : null;

    const resumeExcerptForPrompt = resumeText
      ? resumeText
      : 'Resume text not available. Ask the user to re-upload their resume if needed.';
    
    const systemPrompt = ONBOARDING_SYSTEM_PROMPT
      .replace('{USER_DATA}', userData)
      .replace('{RESUME_TEXT}', resumeExcerptForPrompt);
    
    // Initialize Claude
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const messageStream = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages as any,
            stream: true
          });
          
          let fullResponse = '';
          
          for await (const chunk of messageStream) {
            if (chunk.type === 'content_block_delta') {
              if (chunk.delta.type === 'text_delta') {
                const text = chunk.delta.text;
                fullResponse += text;
                
                // Send text chunk
                const encoded = new TextEncoder().encode(text);
                controller.enqueue(encoded);
              }
            } else if (chunk.type === 'message_stop') {
              // Save assistant response to session
              messages.push({ role: 'assistant', content: fullResponse });

              const { error: insertAssistantMessageError } = await supabase
                .from('onboarding_chat_messages')
                .insert({
                  user_id: userId,
                  session_id: conversationKey,
                  role: 'assistant',
                  content: fullResponse
                });

              if (insertAssistantMessageError) {
                console.error('Failed to store onboarding chat assistant message:', insertAssistantMessageError);
              }
              
              // Check if onboarding is complete
              const completionPhrases = [
                'profile is complete',
                "let's get started",
                'ready to begin',
                'all set'
              ];
              
              const isComplete = completionPhrases.some(phrase => 
                fullResponse.toLowerCase().includes(phrase)
              );
              
              if (isComplete) {
                console.log('✓ Onboarding marked as complete');
                // Update profile to mark onboarding complete
                await supabase
                  .from('user_profiles')
                  .update({
                    onboarding_completed: true,
                    onboarding_completed_at: new Date().toISOString()
                  })
                  .eq('user_id', userId);
                
                // Send completion signal
                const completionSignal = '\n__ONBOARDING_COMPLETE__';
                controller.enqueue(new TextEncoder().encode(completionSignal));
              }
              
              controller.close();
            }
          }
        } catch (error) {
          console.error('Error in onboarding chat stream:', error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          controller.error(new Error(`Stream error: ${errorMsg}`));
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
    
  } catch (error) {
    console.error('Error in onboarding chat endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `Failed to process chat: ${errorMessage}` }),
      { status: 500 }
    );
  }
}
