/**
 * File: app/api/speech-to-text/route.ts
 * Purpose: Handle authenticated audio transcription requests via OpenAI Whisper API.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB upper bound to guard against large uploads

/**
 * Transcribe uploaded audio by proxying the request to OpenAI Whisper.
 * @param request - The incoming HTTP request containing multipart/form-data with an audio file.
 * @returns A JSON response containing the transcription or an error message.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const routeClient = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await routeClient.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      console.error('Missing OPENAI_API_KEY environment variable');
      return NextResponse.json({ error: 'Speech-to-text service not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const audio = formData.get('audio');

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    if (audio.size === 0) {
      return NextResponse.json({ error: 'Received empty audio file' }, { status: 400 });
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio file is too large' }, { status: 413 });
    }

    if (audio.type && !audio.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Unsupported media type' }, { status: 415 });
    }

    const whisperRequest = new FormData();
    whisperRequest.append('file', audio, audio.name || 'recording.webm');
    whisperRequest.append('model', 'whisper-1');
    whisperRequest.append('temperature', '0');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
      },
      body: whisperRequest,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', whisperResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to transcribe audio' },
        { status: whisperResponse.status === 401 ? 502 : whisperResponse.status }
      );
    }

    const transcription = (await whisperResponse.json()) as { text?: string };
    const text = transcription.text?.trim();

    if (!text) {
      return NextResponse.json({ error: 'No transcription returned' }, { status: 502 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Unexpected transcription error', error);
    return NextResponse.json({ error: 'Unexpected transcription error' }, { status: 500 });
  }
}
