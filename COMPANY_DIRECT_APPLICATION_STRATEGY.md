# Direct Company Application Strategy

## Your Goal
Apply to jobs directly on company websites, NOT through job board intermediaries (Indeed/LinkedIn).

## Why This is Better
- **Higher success rate** - Companies prioritize direct applications
- **Shows initiative** - Demonstrates genuine interest
- **Better experience** - Company ATS systems vary, some are easier
- **Less competition** - Fewer applicants go direct
- **More control** - You handle the entire application flow

## Current State vs Target State

### Current (Problematic)
```
Job Board Search → Job Board URL → Apply on Job Board
                                   ❌ Anti-bot detection
                                   ❌ Apply through aggregator
                                   ❌ Less likely to get noticed
```

### Target (What You Want)
```
Job Discovery → Company Name → Company Careers Page → Direct Application
                                                      ✅ Apply on company site
                                                      ✅ Direct to employer
                                                      ✅ Better visibility
```

## Three-Phase Architecture

### Phase 1: Job Discovery
**Goal:** Find jobs that match criteria
**Sources:**
1. **Indeed Publisher API** (best - no bot detection)
   - Returns: company name, job title, location, description
   - Does NOT apply through Indeed
   - Just uses Indeed as a job search engine
   
2. **Manual user search** (fallback)
   - User browses Indeed/LinkedIn manually
   - Pastes job URL to agent
   - Agent extracts company name and details

3. **Google Jobs scraping** (last resort)
   - If APIs unavailable
   - Use for discovery only, not application

**Output:** List of jobs with company names

### Phase 2: Company Career Page Discovery
**Goal:** Find where to actually apply on the company website

**Method 1: Extract from job board listing**
Many Indeed/LinkedIn jobs have an "Apply on company website" button:
```javascript
// On Indeed job page
const companyApplyButton = document.querySelector('[data-indeed-apply-button-type="offsite"]');
// This redirects to actual company careers page
```

**Method 2: Google search for company careers page**
```
"[Company Name]" careers OR jobs site:[companyname].com
```

**Method 3: Company website navigation**
```
1. Google search: "[Company Name]"
2. Navigate to company homepage
3. Look for "Careers", "Jobs", "Join Us" links
4. Find job posting matching title/location
```

**Output:** Direct URL to company application page

### Phase 3: Application Automation
**Goal:** Fill out the application on company website

**Tools you already have:**
- `browser_navigate` - Go to company careers page
- `browser_snapshot` - See form structure
- `browser_type` - Fill text fields
- `browser_click` - Click buttons
- `browser_select` - Choose dropdowns
- File upload for resume (need to add)

**Process:**
1. Navigate to company application URL
2. Take snapshot to see form fields
3. Fill in user data (name, email, phone, resume, etc.)
4. Handle multi-step forms
5. Submit application
6. Verify success

## New Tools Added

### 1. `find_company_careers_page`
```typescript
{
  companyName: "Acme Corp",
  jobTitle: "Software Engineer" // optional, helps find right posting
}
→ {
  careersUrl: "https://acmecorp.com/careers/software-engineer",
  companyWebsite: "https://acmecorp.com"
}
```

### 2. `extract_company_application_url`
```typescript
{
  jobBoardUrl: "https://www.indeed.com/viewjob?jk=abc123"
}
→ {
  companyApplicationUrl: "https://acmecorp.com/careers/apply/12345",
  requiresJobBoard: false  // true if must apply through Indeed
}
```

## Implementation Status

### ✅ Done
- Tool definitions added to `lib/browser-tools.ts`
- Client methods added to BrowserService class
- Architecture documented

### 🔨 TODO: Browser Service Endpoints
Add to `browser-service/src/server.ts`:

```typescript
// Extract company application URL from job board
app.post('/api/extract-company-url', authenticate, async (req, res) => {
  const { jobBoardUrl } = req.body;
  
  const page = await createStealthPage();
  await page.goto(jobBoardUrl);
  
  // Look for "Apply on company website" button
  const companyButton = await page.locator('[data-indeed-apply-button-type="offsite"]').first();
  
  if (await companyButton.count() > 0) {
    await companyButton.click();
    await page.waitForLoadState();
    const companyUrl = page.url();
    
    return res.json({
      success: true,
      data: {
        companyApplicationUrl: companyUrl,
        requiresJobBoard: false
      }
    });
  }
  
  // No direct company link found
  return res.json({
    success: true,
    data: {
      companyApplicationUrl: null,
      requiresJobBoard: true
    }
  });
});

// Find company careers page
app.post('/api/find-careers-page', authenticate, async (req, res) => {
  const { companyName, jobTitle } = req.body;
  
  const page = await createStealthPage();
  
  // Search Google for company careers page
  const searchQuery = `"${companyName}" careers OR jobs ${jobTitle || ''}`;
  await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`);
  
  // Extract first result that looks like careers page
  const careersLink = await page.locator('a[href*="career"], a[href*="jobs"]').first();
  const careersUrl = await careersLink.getAttribute('href');
  
  // Also get company homepage
  const companyLink = await page.locator('a').first();
  const companyWebsite = await companyLink.getAttribute('href');
  
  return res.json({
    success: true,
    data: {
      careersUrl,
      companyWebsite
    }
  });
});
```

### 🔨 TODO: Tool Execution Handlers
Add to `lib/claude-agent.ts` in the `executeTools` function:

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

### 🔨 TODO: Update Agent Instructions
Update `.claude/agents/job-assistant-agent.md` to prioritize direct applications:

```markdown
## Application Strategy

When a user wants to apply to jobs:

1. **Discover Jobs**
   - Use search_jobs_indeed/google to find relevant positions
   - Or user can provide job URLs they found manually

2. **Find Company Application Page** (CRITICAL)
   - Use extract_company_application_url to check if job board has "Apply on company website"
   - If yes, use that URL
   - If no, use find_company_careers_page to locate company's careers site
   - ALWAYS prefer company website over job board application

3. **Apply on Company Website**
   - Navigate to company application URL
   - Use browser tools to fill out application
   - Upload resume, cover letter, etc.
   - Submit application
   - Confirm success

4. **Avoid Job Board Applications**
   - Do NOT use Indeed's "Apply" button
   - Do NOT use LinkedIn's "Easy Apply"
   - Only exception: if company explicitly requires applying through job board
```

## Expected User Flow

```
User: "Find me 5 line cook jobs in Altamonte Springs and apply to them"

Agent:
1. Searches Indeed/Google for "line cook Altamonte Springs"
   → Gets 5 jobs with company names

2. For each job:
   a. Extract company application URL from job board
      OR
   b. Google search "[Company Name] careers Altamonte Springs"
   
3. For each company application page:
   a. Navigate to careers page
   b. Find specific job posting
   c. Click "Apply Now"
   d. Fill application form with user's profile data
   e. Upload resume
   f. Submit
   g. Mark as applied in database

4. Report back: "Applied to 5 jobs directly on company websites"
```

## Benefits of This Approach

1. **More reliable** - Company sites have weaker bot detection than job boards
2. **Better signal** - Shows you took initiative to apply directly
3. **Complete control** - You see exactly where application goes
4. **No intermediary** - Direct relationship with employer
5. **Higher response rate** - Companies prioritize direct applications

## Next Steps

1. **Implement browser service endpoints** (above)
2. **Add tool execution handlers** (above)
3. **Update agent instructions** (above)
4. **Test with real job**:
   - Find a job on Indeed
   - Extract company careers URL
   - Attempt to fill out company application
   - Debug any issues

5. **Consider adding**:
   - Resume file upload support
   - Cover letter generation
   - Application form field mapping
   - Multi-step form handling
   - Success verification
