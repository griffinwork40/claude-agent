import { describe, expect, it } from 'vitest';

// The browser-service code lives outside the Next.js app. We import it directly for unit tests.
import { BrowserJobService } from '../browser-service/src/browser-tools';

describe('BrowserJobService normalizeGoogleJobs', () => {
  it('deduplicates entries and infers remote types', () => {
    const service = new BrowserJobService();
    const rawJobs = [
      {
        id: 'job-1',
        title: 'Software Engineer',
        company: 'Acme Corp',
        location: 'Remote - United States',
        url: 'https://example.com/jobs/1',
        description: 'Build products',
        remoteHint: 'remote'
      },
      {
        id: 'job-duplicate',
        title: 'Software Engineer',
        company: 'Acme Corp',
        location: 'Remote - United States',
        url: 'https://example.com/jobs/1',
        description: 'duplicate entry',
        remoteHint: 'remote'
      },
      {
        id: 'job-2',
        title: 'Staff Engineer',
        company: 'Globex',
        location: 'Hybrid - San Francisco, CA',
        url: '/viewjob?id=987',
        description: 'Lead projects',
        remoteHint: 'hybrid'
      }
    ];

    const params = {
      keywords: 'software engineer',
      location: 'San Francisco, CA',
      remote: false,
      experience_level: 'senior'
    };

    const normalized = (service as any).normalizeGoogleJobs(rawJobs, params, 'https://www.google.com/search?q=test') as Array<{
      remote_type: string;
      url: string;
      experience_level: string;
    }>;

    expect(normalized).toHaveLength(2);
    expect(normalized[0].remote_type).toBe('remote');
    expect(normalized[0].url).toBe('https://example.com/jobs/1');
    expect(normalized[1].remote_type).toBe('hybrid');
    expect(normalized[1].url).toBe('https://www.google.com/viewjob?id=987');
    expect(normalized.every(job => job.experience_level === 'senior')).toBe(true);
  });
});
