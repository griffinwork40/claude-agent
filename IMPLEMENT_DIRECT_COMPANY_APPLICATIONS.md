# Implementation Prompt: Direct Company Application Features

## Context
We've designed a system to apply for jobs directly on company websites instead of through job board intermediaries (Indeed/LinkedIn). The architecture and tool definitions are ready, but we need to implement the actual endpoints and handlers.

## What's Already Done
- ✅ Tool definitions added to `lib/browser-tools.ts`:
  - `find_company_careers_page`
  - `extract_company_application_url`
- ✅ Client methods added to BrowserService class
- ✅ Architecture documented in `COMPANY_DIRECT_APPLICATION_STRATEGY.md`
- ✅ Error handling fixed for job search failures

## What Needs Implementation

### 1. Browser Service Endpoints
**File:** `browser-service/src/server.ts`

Add two new POST endpoints:

#### `/api/extract-company-url`
- **Input:** `{ jobBoardUrl: string }`
- **Purpose:** Navigate to Indeed/LinkedIn job listing and extract "Apply on company website" button link
- **Logic:**
  - Create stealth page
  - Navigate to job board URL
  - Look for selectors like:
    - Indeed: `[data-indeed-apply-button-type="offsite"]`
    - LinkedIn: `[data-tracking-control-name="public_jobs_apply-link-offsite"]`
    - Generic: Look for links containing "company", "website", or external domain
  - Click button and capture redirect URL
  - Return `{ companyApplicationUrl: string | null, requiresJobBoard: boolean }`
- **Error handling:** If no company link found, return `requiresJobBoard: true`

#### `/api/find-careers-page`
- **Input:** `{ companyName: string, jobTitle?: string }`
- **Purpose:** Google search to find company's careers page
- **Logic:**
  - Create stealth page
  - Search Google: `"${companyName}" careers OR jobs ${jobTitle || ''}`
  - Extract first result with URLs containing: "career", "jobs", "apply", "join"
  - Also capture company homepage from search results
  - Return `{ careersUrl: string, companyWebsite: string }`
- **Error handling:** Return generic company website if careers page not found

**Implementation notes:**
- Use existing `createStealthPage()` helper from browser-tools.ts
- Add authentication middleware (already exists)
- Follow existing endpoint patterns in server.ts
- Add proper error logging

### 2. Tool Execution Handlers
**File:** `lib/claude-agent.ts`

Add cases in the `executeTools` switch statement (around line 900-1000):

#### Case: `find_company_careers_page`
```typescript
case 'find_company_careers_page':
  console.log('🔍 Finding company careers page:', input);
  try {
    const careersResult = await browserService.findCompanyCareersPage({
      companyName: input.companyName,
      jobTitle: input.jobTitle
    });
    result = {
      success: true,
      data: careersResult,
      message: `Found careers page: ${careersResult.careersUrl}`
    };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    result = {
      success: false,
      error: errMessage,
      message: `Failed to find careers page: ${errMessage}`
    };
  }
  break;
```

#### Case: `extract_company_application_url`
```typescript
case 'extract_company_application_url':
  console.log('🔍 Extracting company application URL:', input);
  try {
    const extractResult = await browserService.extractCompanyApplicationUrl({
      jobBoardUrl: input.jobBoardUrl
    });
    
    if (extractResult.companyApplicationUrl) {
      result = {
        success: true,
        data: extractResult,
        message: `Found company application URL: ${extractResult.companyApplicationUrl}`
      };
    } else {
      result = {
        success: false,
        data: extractResult,
        message: `This job requires applying through the job board (no direct company application available)`
      };
    }
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    result = {
      success: false,
      error: errMessage,
      message: `Failed to extract company URL: ${errMessage}`
    };
  }
  break;
```

**Implementation notes:**
- Add after existing `search_jobs_linkedin` case
- Follow existing error handling patterns
- Use consistent logging format with emojis

### 3. Agent Instruction Updates
**File:** `.claude/agents/job-assistant-agent.md`

Add a new section called "Application Strategy" with these guidelines:

```markdown
## Application Strategy

When a user wants to apply to jobs, ALWAYS prioritize applying directly on company websites, NOT through job boards.

### Workflow:

1. **Job Discovery Phase**
   - Use search_jobs_indeed or search_jobs_google to find relevant positions
   - These tools are ONLY for discovery - don't apply through job boards
   - Extract: company name, job title, location, job description

2. **Find Company Application Page** (CRITICAL STEP)
   - First, try: `extract_company_application_url` with the job board URL
     - Many Indeed/LinkedIn jobs have "Apply on company website" buttons
     - This is the fastest method
   - If that fails, try: `find_company_careers_page` with company name
     - Google search to find company's careers page
     - Look for specific job posting on company site
   - ALWAYS verify you have a company website URL before proceeding

3. **Apply on Company Website**
   - Use browser automation tools:
     - `browser_navigate` to go to company application URL
     - `browser_snapshot` to see form structure
     - `browser_type` to fill text fields (name, email, phone, etc.)
     - `browser_select` for dropdowns (experience level, etc.)
     - `browser_click` to submit application
   - Handle multi-step forms by repeating snapshot → fill → click cycle
   - Verify success by checking for confirmation message

4. **Avoid Job Board Applications**
   - DO NOT use Indeed's "Apply" button
   - DO NOT use LinkedIn's "Easy Apply"
   - Only exception: if extract_company_application_url returns requiresJobBoard: true
   - If forced to use job board, inform user and ask for manual application

### Why Direct Applications?
- Higher success rate - companies prioritize direct applicants
- Shows initiative - demonstrates genuine interest
- Better visibility - application goes straight to employer
- Less competition - fewer people apply directly
- More control - you handle the entire process

### Example Flow:
```
User: "Apply to this job: https://www.indeed.com/viewjob?jk=abc123"

1. extract_company_application_url({ jobBoardUrl: "https://www.indeed.com/viewjob?jk=abc123" })
   → Returns: { companyApplicationUrl: "https://restaurant.com/careers/apply/12345" }

2. browser_navigate to "https://restaurant.com/careers/apply/12345"

3. browser_snapshot to see form fields

4. Fill form:
   - browser_type for name, email, phone
   - browser_select for position type
   - Handle file upload for resume if needed

5. browser_click on "Submit Application"

6. Verify success and report to user
```
```

**Implementation notes:**
- Add this section after the "Tools Available" section
- Update any existing references to job applications
- Keep tone instructional and clear

## Testing Checklist

After implementation:

1. **Test extract_company_application_url:**
   - Find an Indeed job with "Apply on company website" button
   - Verify it extracts the correct company URL
   - Test with job that requires Indeed application (should return requiresJobBoard: true)

2. **Test find_company_careers_page:**
   - Try common companies: "McDonald's", "Starbucks", "Google"
   - Verify it returns working careers page URLs
   - Test with local restaurant names

3. **Test full flow:**
   - Ask agent: "Find line cook jobs in [location] and apply to 3 of them"
   - Verify agent:
     - Searches for jobs
     - Extracts company URLs
     - Navigates to company sites
     - Attempts to fill applications
     - Reports results

4. **Deploy to Railway:**
   - Commit all changes
   - Push to trigger Railway auto-deploy
   - Test with production browser service

## Success Criteria

- ✅ Browser service endpoints return valid company URLs
- ✅ Tool execution handlers work without errors
- ✅ Agent prioritizes company websites over job boards
- ✅ Agent can complete at least 1 full application on a real company site
- ✅ Error handling gracefully falls back to manual search links

## Files to Modify

1. `browser-service/src/server.ts` - Add endpoints
2. `browser-service/src/browser-tools.ts` - May need helper functions
3. `lib/claude-agent.ts` - Add tool execution cases
4. `.claude/agents/job-assistant-agent.md` - Update instructions

## Reference Documentation

- See `COMPANY_DIRECT_APPLICATION_STRATEGY.md` for full architecture details
- See `BROWSER_SERVICE_ANTI_BOT_FIX.md` for error handling patterns
- Existing endpoint patterns in `browser-service/src/server.ts` (search-indeed, search-google)
- Existing tool execution patterns in `lib/claude-agent.ts` (around line 900)

## Notes

- The goal is to use job boards ONLY for discovery, never for application
- Company websites have much weaker bot detection than job boards
- Direct applications get better response rates from employers
- This is the foundation for the full job application automation system
