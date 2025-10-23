// app/onboarding/page.test.tsx
/**
 * Tests for onboarding page component covering all three steps
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import OnboardingPage from './page';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
    console.log = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  describe('Upload Step', () => {
    it('should render upload form initially', () => {
      render(<OnboardingPage />);
      
      expect(screen.getByText('Welcome to Enlist! 🎯')).toBeInTheDocument();
      expect(screen.getByText("Let's get you set up. Upload your resume to get started.")).toBeInTheDocument();
      expect(screen.getByLabelText('Upload Your Resume')).toBeInTheDocument();
      expect(screen.getByText('Upload & Continue')).toBeInTheDocument();
    });

    it('should show file selection feedback', () => {
      render(<OnboardingPage />);
      
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      expect(screen.getByText('Selected: resume.pdf')).toBeInTheDocument();
      expect(screen.getByText('0.00 KB')).toBeInTheDocument();
    });

    it('should disable upload button when no file selected', () => {
      render(<OnboardingPage />);
      
      const uploadButton = screen.getByText('Upload & Continue');
      expect(uploadButton).toBeDisabled();
    });

    it('should enable upload button when file is selected', () => {
      render(<OnboardingPage />);
      
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      expect(uploadButton).not.toBeDisabled();
    });

    it('should show error when no file is selected for upload', async () => {
      render(<OnboardingPage />);
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Please select a file')).toBeInTheDocument();
      });
    });

    it('should handle successful upload and transition to chat', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            personal_info: {
              name: 'John Doe',
              email: 'john@example.com',
              phone: '123-456-7890',
              location: 'San Francisco, CA'
            },
            experience: {
              skills: ['JavaScript', 'React', 'Node.js'],
              years_experience: 5,
              previous_roles: []
            }
          }
        })
      };

      mockFetch.mockResolvedValue(mockResponse);

      render(<OnboardingPage />);
      
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
        expect(screen.getByText('Chat with our AI assistant to finalize your details')).toBeInTheDocument();
      });
    });

    it('should handle upload errors', async () => {
      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({
          error: 'Failed to upload resume'
        })
      };

      mockFetch.mockResolvedValue(mockResponse);

      render(<OnboardingPage />);
      
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to upload resume')).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<OnboardingPage />);
      
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Chat Step', () => {
    beforeEach(() => {
      // Mock successful upload to get to chat step
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            personal_info: { name: 'John Doe', email: 'john@example.com' },
            experience: { skills: ['JavaScript'], years_experience: 5 }
          }
        })
      };

      mockFetch.mockResolvedValue(mockResponse);
    });

    it('should render chat interface after successful upload', async () => {
      render(<OnboardingPage />);
      
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Type your response...')).toBeInTheDocument();
        expect(screen.getByText('Send')).toBeInTheDocument();
      });
    });

    it('should display initial greeting message', async () => {
      render(<OnboardingPage />);
      
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Hi! I've reviewed your resume/)).toBeInTheDocument();
      });
    });

    it('should handle user input and send messages', async () => {
      // Mock chat response
      const mockChatResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: () => Promise.resolve({
              done: false,
              value: new TextEncoder().encode('Thanks for the information!')
            })
          })
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { personal_info: { name: 'John' }, experience: { skills: [] } }
        })
      }).mockResolvedValueOnce(mockChatResponse);

      render(<OnboardingPage />);
      
      // Upload file first
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
      });

      // Send chat message
      const messageInput = screen.getByPlaceholderText('Type your response...');
      fireEvent.change(messageInput, { target: { value: 'Hello, I am ready to start' } });
      
      const sendButton = screen.getByText('Send');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Hello, I am ready to start')).toBeInTheDocument();
      });
    });

    it('should handle Enter key to send messages', async () => {
      // Mock responses
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { personal_info: { name: 'John' }, experience: { skills: [] } }
        })
      }).mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () => Promise.resolve({
              done: false,
              value: new TextEncoder().encode('Response')
            })
          })
        }
      });

      render(<OnboardingPage />);
      
      // Upload file first
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
      });

      // Send message with Enter key
      const messageInput = screen.getByPlaceholderText('Type your response...');
      fireEvent.change(messageInput, { target: { value: 'Test message' } });
      fireEvent.keyPress(messageInput, { key: 'Enter', code: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument();
      });
    });

    it('should not send message with Shift+Enter', async () => {
      // Mock responses
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { personal_info: { name: 'John' }, experience: { skills: [] } }
        })
      });

      render(<OnboardingPage />);
      
      // Upload file first
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
      });

      // Try to send message with Shift+Enter
      const messageInput = screen.getByPlaceholderText('Type your response...');
      fireEvent.change(messageInput, { target: { value: 'Test message' } });
      fireEvent.keyPress(messageInput, { key: 'Enter', code: 'Enter', shiftKey: true });
      
      // Should not trigger send
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only the upload call
    });

    it('should disable send button when input is empty', async () => {
      // Mock upload response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { personal_info: { name: 'John' }, experience: { skills: [] } }
        })
      });

      render(<OnboardingPage />);
      
      // Upload file first
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
      });

      const sendButton = screen.getByText('Send');
      expect(sendButton).toBeDisabled();
    });

    it('should handle chat errors gracefully', async () => {
      // Mock upload response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { personal_info: { name: 'John' }, experience: { skills: [] } }
        })
      }).mockRejectedValueOnce(new Error('Chat error'));

      render(<OnboardingPage />);
      
      // Upload file first
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
      });

      // Send chat message
      const messageInput = screen.getByPlaceholderText('Type your response...');
      fireEvent.change(messageInput, { target: { value: 'Hello' } });
      
      const sendButton = screen.getByText('Send');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Sorry, I encountered an error. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Completion Step', () => {
    it('should show completion screen and redirect after onboarding complete', async () => {
      // Mock upload response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { personal_info: { name: 'John' }, experience: { skills: [] } }
        })
      });

      // Mock chat response with completion signal
      const mockChatResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: () => Promise.resolve({
              done: false,
              value: new TextEncoder().encode('Great! Your profile is complete. Let\'s get started!\n__ONBOARDING_COMPLETE__')
            })
          })
        }
      };

      mockFetch.mockResolvedValueOnce(mockChatResponse);

      // Mock timers for redirect
      vi.useFakeTimers();

      render(<OnboardingPage />);
      
      // Upload file first
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
      });

      // Send chat message
      const messageInput = screen.getByPlaceholderText('Type your response...');
      fireEvent.change(messageInput, { target: { value: 'I am done' } });
      
      const sendButton = screen.getByText('Send');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('All Set!')).toBeInTheDocument();
        expect(screen.getByText('Your profile is complete. Redirecting to your dashboard...')).toBeInTheDocument();
      });

      // Fast-forward timers to trigger redirect
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(mockPush).toHaveBeenCalledWith('/agent');

      vi.useRealTimers();
    });

    it('should show loading spinner on completion screen', async () => {
      // Mock upload response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { personal_info: { name: 'John' }, experience: { skills: [] } }
        })
      });

      // Mock chat response with completion signal
      const mockChatResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: () => Promise.resolve({
              done: false,
              value: new TextEncoder().encode('__ONBOARDING_COMPLETE__')
            })
          })
        }
      };

      mockFetch.mockResolvedValueOnce(mockChatResponse);

      render(<OnboardingPage />);
      
      // Upload file first
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      const uploadButton = screen.getByText('Upload & Continue');
      fireEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
      });

      // Send chat message
      const messageInput = screen.getByPlaceholderText('Type your response...');
      fireEvent.change(messageInput, { target: { value: 'Done' } });
      
      const sendButton = screen.getByText('Send');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('All Set!')).toBeInTheDocument();
        // Check for loading spinner (it has animate-spin class)
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      });
    });
  });

  describe('File Validation', () => {
    it('should accept PDF files', () => {
      render(<OnboardingPage />);
      
      const fileInput = screen.getByLabelText('Upload Your Resume');
      expect(fileInput).toHaveAttribute('accept', '.pdf,.txt,.docx');
    });

    it('should show file size information', () => {
      render(<OnboardingPage />);
      
      const fileInput = screen.getByLabelText('Upload Your Resume');
      const testFile = new File(['test content'], 'resume.pdf', { type: 'application/pdf' });
      
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      
      expect(screen.getByText('Supported formats: PDF, DOCX, TXT (max 5MB)')).toBeInTheDocument();
    });
  });
});
