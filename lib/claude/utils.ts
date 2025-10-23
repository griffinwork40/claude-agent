/**
 * Utility Functions Module
 * 
 * Contains utility functions for the Claude agent.
 * Extracted from claude-agent.ts for better modularity and maintainability.
 */

import { ToolResult, BrowserToolResult, JobOpportunity } from '@/types';

/**
 * Build a job summary from tool results
 */
export function buildJobSummaryFromResults(results: ToolResult[]): string | null {
  const jobHighlights: string[] = [];
  const seenJobKeys = new Set<string>();
  const sources = new Set<string>();
  let totalJobs = 0;
  const errorMessages: string[] = [];

  for (const result of results) {
    let parsed: BrowserToolResult | null = null;

    if (typeof result.content === 'string') {
      try {
        parsed = JSON.parse(result.content) as BrowserToolResult;
      } catch (error) {
        if (result.is_error) {
          errorMessages.push(result.content);
        }
        continue;
      }
    } else if (result.is_error) {
      errorMessages.push(String(result.content));
      continue;
    }

    if (!parsed) {
      continue;
    }

    if (result.is_error || parsed.success === false) {
      const errorMessage =
        typeof parsed.message === 'string'
          ? parsed.message
          : typeof parsed.error === 'string'
            ? parsed.error
            : null;
      if (errorMessage) {
        errorMessages.push(errorMessage);
      }
      continue;
    }

    const dataCandidate = parsed.data;
    let jobs: JobOpportunity[] = [];

    if (Array.isArray(dataCandidate)) {
      jobs = dataCandidate as JobOpportunity[];
    } else if (
      dataCandidate &&
      typeof dataCandidate === 'object' &&
      Array.isArray((dataCandidate as Record<string, unknown>).jobs)
    ) {
      const nested = (dataCandidate as { jobs: unknown }).jobs;
      jobs = Array.isArray(nested) ? (nested as JobOpportunity[]) : [];
    }

    if (!jobs.length) {
      continue;
    }

    for (const job of jobs) {
      if (!job || typeof job !== 'object') {
        continue;
      }

      const title = typeof job.title === 'string' ? job.title : null;
      const company = typeof job.company === 'string' ? job.company : null;
      if (!title || !company) {
        continue;
      }

      const location = typeof job.location === 'string' ? job.location : null;
      const key =
        typeof job.id === 'string' && job.id.trim().length
          ? job.id.trim()
          : `${title}|${company}|${location || ''}`;

      if (!seenJobKeys.has(key)) {
        seenJobKeys.add(key);
        totalJobs++;

        const highlightParts = [`• ${title}`, `at ${company}`];
        if (location) {
          highlightParts.push(`(${location})`);
        }
        jobHighlights.push(highlightParts.join(' '));
      }

      if (typeof job.source === 'string' && job.source.trim().length) {
        sources.add(job.source.trim());
      }
    }
  }

  if (totalJobs === 0 && errorMessages.length === 0) {
    return null;
  }

  const summaryParts: string[] = [];

  if (totalJobs > 0) {
    const sourceSuffix =
      sources.size > 0
        ? ` across ${Array.from(sources)
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(', ')}`
        : '';
    summaryParts.push(`I found ${totalJobs} role${totalJobs === 1 ? '' : 's'}${sourceSuffix}.`);

    const highlightText = jobHighlights.slice(0, 3).join('\n');
    if (highlightText) {
      summaryParts.push(`Highlights:\n${highlightText}`);
    }
  }

  if (errorMessages.length > 0) {
    const errorText = errorMessages.slice(0, 2).join('; ');
    summaryParts.push(`A few searches failed: ${errorText}.`);
  }

  if (summaryParts.length === 0) {
    return null;
  }

  summaryParts.push('Let me know if you want to refine the search or apply to any of these.');
  return summaryParts.join('\n\n');
}

/**
 * Calculate token usage percentage
 */
export function calculateTokenPercentage(inputTokens: number, outputTokens: number, contextLimit: number): number {
  const totalTokens = inputTokens + outputTokens;
  return (totalTokens / contextLimit) * 100;
}

/**
 * Check if context limit is approaching
 */
export function isContextLimitApproaching(totalTokens: number, contextLimit: number, threshold: number = 0.95): boolean {
  return totalTokens >= Math.floor(contextLimit * threshold);
}