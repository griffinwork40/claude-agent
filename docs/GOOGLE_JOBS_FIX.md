# Google Jobs Search Not Working - Root Cause & Fix

## Problem
Google Jobs search was not being used, even though the backend endpoint existed and was working. The agent would instead use low-level browser automation tools to manually scrape Indeed.

## Root Cause

The issue had **two parts**:

### 1. Missing Tool Definitions
Only `search_jobs_google` was defined in the `browserTools` array in `lib/browser-tools.ts`. The tools `search_jobs_indeed` and `search_jobs_linkedin` were **missing**, even though:
- The agent instructions referenced them
- The backend API endpoints existed (`/api/search-indeed`, `/api/search-linkedin`)
- The browser service implementation had the methods

### 2. Agent Instructions Mismatch
The agent instructions in `.claude/agents/job-assistant-agent.md` said:
> "Use `search_jobs_indeed` first (no auth required) to get initial results"

But since `search_jobs_indeed` wasn't available as a tool, the agent fell back to using low-level browser automation (`browser_navigate`, `browser_evaluate`, etc.) to manually scrape Indeed instead.

The agent **never used Google** because:
1. It was instructed to use Indeed first
2. Indeed wasn't available as a high-level tool
3. It used manual scraping to accomplish the task
4. Google was never attempted

## What Was Working
- ✅ Backend browser service had all three search implementations
- ✅ Backend API had all three endpoints (`/api/search-indeed`, `/api/search-google`, `/api/search-linkedin`)
- ✅ The `search_jobs_google` tool definition existed
- ✅ Tool handler in `claude-agent.ts` for Google existed

## What Was Broken
- ❌ Tool definitions for `search_jobs_indeed` and `search_jobs_linkedin` were missing
- ❌ BrowserService class was missing methods for Indeed and LinkedIn
- ❌ Tool handlers in `claude-agent.ts` were missing for Indeed and LinkedIn
- ❌ Agent instructions promoted using Indeed first, but the tool didn't exist

## The Fix

### 1. Added Missing Tool Definitions (`lib/browser-tools.ts`)
```typescript
{
  name: 'search_jobs_indeed',
  description: 'Search Indeed for job listings. Returns real job postings from Indeed.com.',
  input_schema: {
    type: 'object' as const,
    properties: {
      keywords: { type: 'string', description: '...' },
      location: { type: 'string', description: '...' },
      experience_level: { type: 'string', enum: [...] },
      remote: { type: 'boolean' }
    },
    required: ['keywords', 'location']
  }
}
```

Added similar definitions for `search_jobs_linkedin`.

### 2. Added BrowserService Methods (`lib/browser-tools.ts`)
```typescript
async searchJobsIndeed(params: { ... }): Promise<JobOpportunity[]> {
  return this.request('/api/search-indeed', params);
}

async searchJobsLinkedIn(params: { ... }): Promise<JobOpportunity[]> {
  return this.request('/api/search-linkedin', params);
}
```

### 3. Added Tool Handlers (`lib/claude-agent.ts`)
```typescript
case 'search_jobs_indeed':
  const indeedJobsResult = await browserService.searchJobsIndeed({ ... });
  // ... handle result
  break;

case 'search_jobs_linkedin':
  const linkedinJobsResult = await browserService.searchJobsLinkedIn({ ... });
  // ... handle result
  break;
```

### 4. Updated Agent Instructions (`.claude/agents/job-assistant-agent.md`)
Changed the workflow to:
- **Prefer** high-level search tools over manual browser scraping
- Use `search_jobs_google` as the **default** (comprehensive multi-source results)
- Use `search_jobs_indeed` for Indeed-specific searches
- Use `search_jobs_linkedin` only if user has connected LinkedIn
- **Avoid** low-level browser tools unless high-level tools fail

## Testing
After the fix, the agent should:
1. Use `search_jobs_google` for most job searches (comprehensive results)
2. Use `search_jobs_indeed` when specifically requested or as fallback
3. Use `search_jobs_linkedin` only when LinkedIn is authenticated
4. **NOT** use manual browser scraping (`browser_navigate`, `browser_evaluate`) for job searches

## Why This Happened
This appears to be a refactoring issue. At some point:
1. The high-level job search tools were removed from the tools array
2. Only the low-level browser automation tools and Google search remained
3. The agent instructions and backend code still referenced the missing tools
4. The agent adapted by using manual browser scraping to accomplish the task

## Lesson Learned
When working with LLM tool-calling systems:
- **Tool definitions must match instructions** - if you tell the agent to use a tool, it must exist
- **Keep high-level and low-level tools separate** - don't mix job search abstractions with browser primitives
- **The LLM will adapt** - if a tool is missing, Claude will try to accomplish the task using available tools (in this case, manual scraping)
- **Test all tools regularly** - this issue went unnoticed because manual scraping "worked", just inefficiently

