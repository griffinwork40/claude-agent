import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBrowserService } from '../browser-tools';

// Set test environment variable for API key
process.env.BROWSER_SERVICE_API_KEY = 'test-key-12345';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BrowserService', () => {
  let browserService: ReturnType<typeof getBrowserService>;

  beforeEach(() => {
    vi.clearAllMocks();
    browserService = getBrowserService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchJobsIndeed', () => {
    it('should handle Indeed search success', async () => {
      const mockJobs = [
        {
          id: 'test-1',
          title: 'Line Cook',
          company: 'Restaurant ABC',
          location: 'Altamonte Springs, FL',
          salary: '$15-18/hr',
          url: 'https://indeed.com/viewjob?jk=123',
          description: 'Cooking and food preparation',
          application_url: 'https://indeed.com/viewjob?jk=123',
          source: 'indeed' as const,
          skills: [],
          experience_level: 'unknown',
          job_type: 'full-time',
          remote_type: 'unknown',
          applied: false,
          status: 'discovered' as const,
          created_at: new Date().toISOString()
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockJobs
        })
      });

      const results = await browserService.searchJobsIndeed({
        keywords: 'line cook',
        location: 'Altamonte Springs'
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Line Cook');
      expect(results[0].company).toBe('Restaurant ABC');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search-indeed'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key-12345'
          }),
          body: JSON.stringify({
            keywords: 'line cook',
            location: 'Altamonte Springs'
          })
        })
      );
    });

    it('should handle Indeed search API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ 
          success: false,
          error: 'Internal server error' 
        })
      });

      await expect(
        browserService.searchJobsIndeed({
          keywords: 'line cook',
          location: 'Altamonte Springs'
        })
      ).rejects.toThrow('Browser service error (500)');
    });

    it('should handle network timeout', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(
        browserService.searchJobsIndeed({
          keywords: 'line cook',
          location: 'Altamonte Springs'
        })
      ).rejects.toThrow('Request timeout');
    });

    it('should handle service returning failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'No jobs found'
        })
      });

      await expect(
        browserService.searchJobsIndeed({
          keywords: 'line cook',
          location: 'Altamonte Springs'
        })
      ).rejects.toThrow('No jobs found');
    });
  });

  describe('searchJobsGoogle', () => {
    it('should handle Google Jobs search success', async () => {
      const mockJobs = [
        {
          id: 'google-test-1',
          title: 'Software Engineer',
          company: 'Tech Corp',
          location: 'San Francisco, CA',
          salary: '$120k - $160k',
          url: 'https://google.com/jobs/123',
          description: 'Full-stack development',
          application_url: 'https://google.com/jobs/123',
          source: 'google' as const,
          skills: [],
          experience_level: 'unknown',
          job_type: 'full-time',
          remote_type: 'unknown',
          applied: false,
          status: 'discovered' as const,
          created_at: new Date().toISOString()
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockJobs
        })
      });

      const results = await browserService.searchJobsGoogle({
        keywords: 'software engineer',
        location: 'San Francisco'
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Software Engineer');
      expect(results[0].source).toBe('google');
    });

    it('should handle Google Jobs search API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ 
          success: false,
          error: 'Missing required parameters' 
        })
      });

      await expect(
        browserService.searchJobsGoogle({
          keywords: 'software engineer',
          location: 'San Francisco'
        })
      ).rejects.toThrow('Browser service error (400)');
    });
  });

  describe('searchJobsLinkedIn', () => {
    it('should handle LinkedIn search success', async () => {
      const mockJobs = [
        {
          id: 'linkedin-test-1',
          title: 'Product Manager',
          company: 'StartupXYZ',
          location: 'New York, NY',
          salary: undefined,
          url: 'https://linkedin.com/jobs/123',
          description: 'Product strategy and management',
          application_url: 'https://linkedin.com/jobs/123',
          source: 'linkedin' as const,
          skills: [],
          experience_level: 'unknown',
          job_type: 'full-time',
          remote_type: 'unknown',
          applied: false,
          status: 'discovered' as const,
          created_at: new Date().toISOString()
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockJobs
        })
      });

      const results = await browserService.searchJobsLinkedIn({
        keywords: 'product manager',
        location: 'New York',
        userId: 'test-user-123'
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Product Manager');
      expect(results[0].source).toBe('linkedin');
    });

    it('should handle LinkedIn authentication error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{
            id: 'linkedin_auth_required_123',
            title: 'Authentication Required',
            company: 'LinkedIn',
            location: 'New York',
            description: 'LinkedIn search requires authentication. Please log in to LinkedIn to search for jobs.',
            url: 'https://linkedin.com/jobs/search',
            application_url: '',
            source: 'linkedin' as const,
            skills: [],
            experience_level: 'unknown',
            job_type: 'full-time',
            remote_type: 'unknown',
            applied: false,
            status: 'error' as const,
            created_at: new Date().toISOString(),
            error: 'LinkedIn authentication required'
          }]
        })
      });

      const results = await browserService.searchJobsLinkedIn({
        keywords: 'product manager',
        location: 'New York',
        userId: 'test-user-123'
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Authentication Required');
      expect(results[0].status).toBe('error');
      expect(results[0].error).toBe('LinkedIn authentication required');
    });
  });

  describe('error handling', () => {
    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      await expect(
        browserService.searchJobsIndeed({
          keywords: 'test',
          location: 'test'
        })
      ).rejects.toThrow('Invalid JSON');
    });

    it('should handle network connection error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(
        browserService.searchJobsIndeed({
          keywords: 'test',
          location: 'test'
        })
      ).rejects.toThrow('Network connection failed');
    });

    it('should handle timeout error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(
        browserService.searchJobsIndeed({
          keywords: 'test',
          location: 'test'
        })
      ).rejects.toThrow('Request timeout');
    });
  });

  describe('parameter validation', () => {
    it('should pass all parameters correctly to Indeed search', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });

      await browserService.searchJobsIndeed({
        keywords: 'line cook',
        location: 'Altamonte Springs',
        experience_level: 'entry',
        remote: true
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search-indeed'),
        expect.objectContaining({
          body: JSON.stringify({
            keywords: 'line cook',
            location: 'Altamonte Springs',
            experience_level: 'entry',
            remote: true
          })
        })
      );
    });

    it('should pass all parameters correctly to Google Jobs search', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });

      await browserService.searchJobsGoogle({
        keywords: 'software engineer',
        location: 'San Francisco',
        experience_level: 'senior',
        remote: false
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search-google'),
        expect.objectContaining({
          body: JSON.stringify({
            keywords: 'software engineer',
            location: 'San Francisco',
            experience_level: 'senior',
            remote: false
          })
        })
      );
    });

    it('should pass all parameters correctly to LinkedIn search', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });

      await browserService.searchJobsLinkedIn({
        keywords: 'product manager',
        location: 'New York',
        experience_level: 'mid',
        remote: true,
        userId: 'user-123'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search-linkedin'),
        expect.objectContaining({
          body: JSON.stringify({
            keywords: 'product manager',
            location: 'New York',
            experience_level: 'mid',
            remote: true,
            userId: 'user-123'
          })
        })
      );
    });
  });
});
