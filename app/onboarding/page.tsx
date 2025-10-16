// app/onboarding/page.tsx
/**
 * Onboarding page for new users.
 * Step 1: Upload resume
 * Step 2: Chat with AI to complete profile
 * Step 3: Redirect to agent dashboard
 */

"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

interface ParsedData {
  personal_info: {
    name: string;
    email: string;
    phone: string;
    location: string;
  };
  experience: {
    skills: string[];
    years_experience: number;
    previous_roles: any[];
  };
  education?: any[];
  summary?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<'upload' | 'chat' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [error, setError] = useState<string>('');
  
  // Chat state
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  // Upload and parse resume
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch('/api/onboarding/upload-resume', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload resume');
      }

      console.log('Resume parsed:', result);
      setParsedData(result.data);
      
      // Move to chat step
      setStep('chat');
      
      // Send initial greeting from bot
      const greeting = `Hi! I've reviewed your resume. Let me help you complete your profile. I can see you have experience in ${result.data.experience.skills.slice(0, 3).join(', ')}. Let's make sure we have all your information correct. First, can you confirm your location: ${result.data.personal_info.location || 'not provided'}?`;
      
      setMessages([{ role: 'assistant', content: greeting }]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to upload resume';
      setError(errorMsg);
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  // Send chat message
  const handleSendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);

    try {
      const response = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          
          // Check for completion signal
          if (chunk.includes('__ONBOARDING_COMPLETE__')) {
            console.log('Onboarding complete!');
            setStep('complete');
            // Redirect after 2 seconds
            setTimeout(() => {
              router.push('/agent');
            }, 2000);
            break;
          }
          
          assistantMessage += chunk;
          
          // Update the last message (or add new one)
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg?.role === 'assistant' && !lastMsg.content.includes('__ONBOARDING_COMPLETE__')) {
              // Update existing assistant message
              newMessages[newMessages.length - 1] = { role: 'assistant', content: assistantMessage };
            } else {
              // Add new assistant message
              newMessages.push({ role: 'assistant', content: assistantMessage });
            }
            return newMessages;
          });
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsStreaming(false);
    }
  };

  // Upload step UI
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Welcome to Enlist! 🎯</h1>
            <p className="text-xl text-[var(--fg)]/70">
              Let's get you set up. Upload your resume to get started.
            </p>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8">
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Upload Your Resume
              </label>
              <input
                type="file"
                accept=".pdf,.txt,.docx"
                onChange={handleFileChange}
                className="block w-full text-sm text-[var(--fg)]
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-[var(--accent)] file:text-white
                  hover:file:bg-[var(--accent)]/90
                  file:cursor-pointer cursor-pointer"
              />
              <p className="mt-2 text-xs text-[var(--fg)]/60">
                Supported formats: PDF, DOCX, TXT (max 5MB)
              </p>
            </div>

            {file && (
              <div className="mb-6 p-4 bg-[var(--muted)]/30 rounded-md">
                <p className="text-sm">
                  <span className="font-medium">Selected:</span> {file.name}
                </p>
                <p className="text-xs text-[var(--fg)]/60">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-md">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full"
            >
              {uploading ? 'Processing...' : 'Upload & Continue'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Chat step UI
  if (step === 'chat') {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center p-4">
        <div className="max-w-3xl w-full h-[80vh] flex flex-col">
          <div className="text-center mb-4">
            <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
            <p className="text-[var(--fg)]/70">
              Chat with our AI assistant to finalize your details
            </p>
          </div>

          <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg flex flex-col">
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--muted)]/30 text-[var(--fg)]'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-[var(--border)] p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your response..."
                  disabled={isStreaming}
                  className="flex-1 px-4 py-2 bg-[var(--muted)]/30 border border-[var(--border)] rounded-md
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isStreaming}
                >
                  {isStreaming ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Completion step
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold mb-2">All Set!</h1>
          <p className="text-[var(--fg)]/70">
            Your profile is complete. Redirecting to your dashboard...
          </p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
        </div>
      </div>
    </div>
  );
}
