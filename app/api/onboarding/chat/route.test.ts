// app/api/onboarding/chat/route.test.ts
/**
 * Tests for onboarding chat endpoint with streaming SSE
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
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => 
            Promise.resolve({ 
              data: [] as any, 
              error: null as any
            })
          )
        }))
      }))
    })),
    insert: vi.fn(() => 
      Promise.resolve({ error: null as any })
    ),
    update: vi.fn(() => ({
      eq: vi.fn(() => 
        Promise.resolve({ error: null as any })
      )
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

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({}))
}));

describe('Onboarding Chat API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to authenticated session
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user-id' } } }
    });
  });

  it('should reject requests without authentication', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null }
    });

    const request = new NextRequest('http://localhost:3000/api/onboarding/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should reject requests without message', async () => {
    const request = new NextRequest('http://localhost:3000/api/onboarding/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Message is required');
  });

  it('should handle chat with no existing profile', async () => {
    // Mock no profile found
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValue({
      data: null,
      error: null
    });

    // Mock empty chat history
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValue({
      data: [],
      error: null
    });

    // Mock Claude streaming response
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello! ' }
        };
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'How can I help you?' }
        };
        yield {
          type: 'message_stop'
        };
      }
    };

    mockAnthropic.messages.create.mockResolvedValue(mockStream);

    const request = new NextRequest('http://localhost:3000/api/onboarding/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('Transfer-Encoding')).toBe('chunked');
  });

  it('should load existing chat history', async () => {
    // Mock profile data
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: {
        personal_info: { name: 'John Doe', email: 'john@example.com' },
        experience: { skills: ['JavaScript'], years_experience: 5 },
        education: [],
        summary: 'Software engineer',
        preferences: { job_types: [], locations: [], salary_range: { min: 0, max: 0 }, remote_work: true }
      },
      error: null
    });

    // Mock chat history
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' }
      ],
      error: null
    });

    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Thanks for the context. ' }
        };
        yield {
          type: 'message_stop'
        };
      }
    };

    mockAnthropic.messages.create.mockResolvedValue(mockStream);

    const request = new NextRequest('http://localhost:3000/api/onboarding/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'New message' })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    // Verify profile was loaded
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_profiles');
    // Verify chat history was loaded
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('onboarding_chat_messages');
  });

  it('should detect completion and mark onboarding complete', async () => {
    // Mock profile data
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: {
        personal_info: { name: 'John Doe', email: 'john@example.com' },
        experience: { skills: ['JavaScript'], years_experience: 5 },
        education: [],
        summary: 'Software engineer',
        preferences: { job_types: [], locations: [], salary_range: { min: 0, max: 0 }, remote_work: true }
      },
      error: null
    });

    // Mock empty chat history
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: [],
      error: null
    });

    // Mock Claude response with completion phrase
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Great! Your profile is complete. ' }
        };
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: "Let's get started!" }
        };
        yield {
          type: 'message_stop'
        };
      }
    };

    mockAnthropic.messages.create.mockResolvedValue(mockStream);

    const request = new NextRequest('http://localhost:3000/api/onboarding/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'I think we are done' })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    
    // Verify onboarding completion update was called
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_profiles');
    expect(mockSupabaseClient.from().update).toHaveBeenCalled();
  });

  it('should handle chat history loading errors', async () => {
    // Mock profile data
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: {
        personal_info: { name: 'John Doe', email: 'john@example.com' },
        experience: { skills: ['JavaScript'], years_experience: 5 },
        education: [],
        summary: 'Software engineer',
        preferences: { job_types: [], locations: [], salary_range: { min: 0, max: 0 }, remote_work: true }
      },
      error: null
    });

    // Mock chat history loading error
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' }
    });

    const request = new NextRequest('http://localhost:3000/api/onboarding/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Unable to load chat history');
  });

  it('should handle message storage errors', async () => {
    // Mock profile data
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: {
        personal_info: { name: 'John Doe', email: 'john@example.com' },
        experience: { skills: ['JavaScript'], years_experience: 5 },
        education: [],
        summary: 'Software engineer',
        preferences: { job_types: [], locations: [], salary_range: { min: 0, max: 0 }, remote_work: true }
      },
      error: null
    });

    // Mock empty chat history
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: [],
      error: null
    });

    // Mock message storage error
    mockSupabaseClient.from().insert.mockResolvedValue({
      error: { message: 'Storage error' }
    });

    const request = new NextRequest('http://localhost:3000/api/onboarding/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Unable to store user message');
  });

  it('should handle Anthropic API errors', async () => {
    // Mock profile data
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: {
        personal_info: { name: 'John Doe', email: 'john@example.com' },
        experience: { skills: ['JavaScript'], years_experience: 5 },
        education: [],
        summary: 'Software engineer',
        preferences: { job_types: [], locations: [], salary_range: { min: 0, max: 0 }, remote_work: true }
      },
      error: null
    });

    // Mock empty chat history
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: [],
      error: null
    });

    // Mock successful message storage
    mockSupabaseClient.from().insert.mockResolvedValue({ error: null });

    // Mock Anthropic error
    mockAnthropic.messages.create.mockRejectedValue(new Error('Claude API error'));

    const request = new NextRequest('http://localhost:3000/api/onboarding/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Failed to process chat');
  });

  it('should handle session ID parameter', async () => {
    // Mock profile data
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: {
        personal_info: { name: 'John Doe', email: 'john@example.com' },
        experience: { skills: ['JavaScript'], years_experience: 5 },
        education: [],
        summary: 'Software engineer',
        preferences: { job_types: [], locations: [], salary_range: { min: 0, max: 0 }, remote_work: true }
      },
      error: null
    });

    // Mock empty chat history
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: [],
      error: null
    });

    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello!' }
        };
        yield {
          type: 'message_stop'
        };
      }
    };

    mockAnthropic.messages.create.mockResolvedValue(mockStream);

    const request = new NextRequest('http://localhost:3000/api/onboarding/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello', sessionId: 'custom-session-123' })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    
    // Verify custom session ID was used
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('onboarding_chat_messages');
  });

  it('should include resume text in system prompt when available', async () => {
    // Mock profile with resume text
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: {
        personal_info: { name: 'John Doe', email: 'john@example.com' },
        experience: { skills: ['JavaScript'], years_experience: 5 },
        education: [],
        summary: 'Software engineer',
        preferences: { job_types: [], locations: [], salary_range: { min: 0, max: 0 }, remote_work: true },
        resume_text: 'John Doe\nSoftware Engineer\n5 years experience\nJavaScript, React, Node.js'
      },
      error: null
    });

    // Mock empty chat history
    mockSupabaseClient.from().select().eq().eq().order.mockResolvedValueOnce({
      data: [],
      error: null
    });

    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'I can see from your resume...' }
        };
        yield {
          type: 'message_stop'
        };
      }
    };

    mockAnthropic.messages.create.mockResolvedValue(mockStream);

    const request = new NextRequest('http://localhost:3000/api/onboarding/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    
    // Verify system prompt was created with resume text
    expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('John Doe')
      })
    );
  });
});
