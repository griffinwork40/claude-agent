# Job Search Function Testing Guide

This guide provides comprehensive testing procedures for the job search functions (`search_jobs_indeed`, `search_jobs_google`, `search_jobs_linkedin`) to ensure they work correctly and provide meaningful error messages.

## Prerequisites

- Browser service running at `https://claude-agent-production.up.railway.app`
- API key: `your-api-key-here`
- `curl` command available
- `jq` command available (optional, for JSON formatting)

## Quick Health Check

First, verify the browser service is running:

```bash
curl -s https://claude-agent-production.up.railway.app/health | jq
```

Expected response:
```json
{
  "status": "ok",
  "service": "llm-browser-automation",
  "activeSessions": 0,
  "timestamp": "2025-01-13T..."
}
```

## Testing Individual Search Functions

### 1. Indeed Search Testing

**Basic search:**
```bash
curl -X POST https://claude-agent-production.up.railway.app/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{"keywords":"line cook","location":"Altamonte Springs"}' | jq
```

**Expected success response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "indeed_1234567890_0",
      "title": "Line Cook",
      "company": "Restaurant Name",
      "location": "Altamonte Springs, FL",
      "salary": "$15-18/hr",
      "url": "https://indeed.com/viewjob?jk=...",
      "description": "Job description...",
      "application_url": "https://indeed.com/viewjob?jk=...",
      "source": "indeed",
      "skills": [],
      "experience_level": "unknown",
      "job_type": "full-time",
      "remote_type": "unknown",
      "applied": false,
      "status": "discovered",
      "created_at": "2025-01-13T..."
    }
  ]
}
```

**Expected error response (no jobs found):**
```json
{
  "success": true,
  "data": [
    {
      "id": "indeed_no_results_1234567890",
      "title": "No Jobs Found",
      "company": "Indeed",
      "location": "Altamonte Springs",
      "description": "No job listings found for \"line cook\" in Altamonte Springs. This could be due to: 1) No jobs matching criteria, 2) Indeed's anti-bot protection, 3) Selector changes.",
      "url": "https://www.indeed.com/jobs?q=line+cook&l=Altamonte+Springs",
      "application_url": "",
      "source": "indeed",
      "status": "error",
      "error": "No jobs found - possible selector issues or anti-bot protection"
    }
  ]
}
```

**Test with missing parameters:**
```bash
curl -X POST https://claude-agent-production.up.railway.app/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{"keywords":"line cook"}' | jq
```

**Expected error response:**
```json
{
  "success": false,
  "error": "Missing required parameters: keywords and location are required",
  "details": {
    "keywords": true,
    "location": false
  }
}
```

### 2. Google Jobs Search Testing

**Basic search:**
```bash
curl -X POST https://claude-agent-production.up.railway.app/api/search-google \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{"keywords":"software engineer","location":"San Francisco"}' | jq
```

**Expected success response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "google_1234567890_0",
      "title": "Software Engineer",
      "company": "Tech Company",
      "location": "San Francisco, CA",
      "salary": "$120k - $160k",
      "url": "https://google.com/jobs/...",
      "description": "Full-stack development...",
      "application_url": "https://google.com/jobs/...",
      "source": "google",
      "status": "discovered"
    }
  ]
}
```

**Test with remote filter:**
```bash
curl -X POST https://claude-agent-production.up.railway.app/api/search-google \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{"keywords":"remote developer","location":"Remote","remote":true}' | jq
```

### 3. LinkedIn Search Testing

**Basic search (may require authentication):**
```bash
curl -X POST https://claude-agent-production.up.railway.app/api/search-linkedin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{"keywords":"product manager","location":"New York","userId":"test-user-123"}' | jq
```

**Expected success response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "linkedin_1234567890_0",
      "title": "Product Manager",
      "company": "StartupXYZ",
      "location": "New York, NY",
      "url": "https://linkedin.com/jobs/...",
      "description": "Product strategy...",
      "application_url": "https://linkedin.com/jobs/...",
      "source": "linkedin",
      "status": "discovered"
    }
  ]
}
```

**Expected authentication error:**
```json
{
  "success": true,
  "data": [
    {
      "id": "linkedin_auth_required_1234567890",
      "title": "Authentication Required",
      "company": "LinkedIn",
      "location": "New York",
      "description": "LinkedIn search requires authentication. Please log in to LinkedIn to search for jobs.",
      "url": "https://www.linkedin.com/jobs/search?keywords=product+manager&location=New+York",
      "source": "linkedin",
      "status": "error",
      "error": "LinkedIn authentication required"
    }
  ]
}
```

## Testing Error Scenarios

### 1. Invalid API Key

```bash
curl -X POST https://claude-agent-production.up.railway.app/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-key" \
  -d '{"keywords":"test","location":"test"}' | jq
```

**Expected response:**
```json
{
  "error": "Unauthorized"
}
```

### 2. Network Timeout

Test with a very long timeout to see if the service handles it gracefully:

```bash
timeout 35s curl -X POST https://claude-agent-production.up.railway.app/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{"keywords":"test","location":"test"}'
```

### 3. Malformed JSON

```bash
curl -X POST https://claude-agent-production.up.railway.app/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{"keywords":"test","location":"test"' | jq
```

## Testing via Chat Interface

### 1. Start the Next.js Application

```bash
cd /Users/griffinlong/Projects/personal_projects/claude-agent
npm run dev
```

### 2. Navigate to Agent Interface

Go to `http://localhost:3000/agent` and log in.

### 3. Test Job Search Queries

Try these test queries in the chat interface:

**Basic Indeed search:**
```
Find line cook jobs in Altamonte Springs, FL
```

**Google Jobs search:**
```
Search for software engineer jobs in San Francisco using Google Jobs
```

**LinkedIn search:**
```
Look for product manager jobs in New York on LinkedIn
```

**Error handling test:**
```
Find jobs with no location specified
```

### 4. Expected Chat Responses

The agent should now provide:

1. **Detailed error messages** when searches fail
2. **Structured job listings** when searches succeed
3. **Fallback suggestions** when no jobs are found
4. **Authentication guidance** for LinkedIn searches

## Common Error Scenarios and Fixes

### 1. "No jobs found" with error status

**Cause:** Selector changes, anti-bot protection, or no matching jobs
**Fix:** Check browser service logs, update selectors if needed

### 2. "Authentication required" for LinkedIn

**Cause:** LinkedIn session expired or not logged in
**Fix:** Re-authenticate LinkedIn session or use Indeed/Google Jobs instead

### 3. "Browser service error (500)"

**Cause:** Internal server error in browser service
**Fix:** Check browser service logs, restart service if needed

### 4. "Request timeout"

**Cause:** Network issues or service overload
**Fix:** Retry request, check service health

## Validation Checklist

After implementing fixes, verify:

- [ ] Health check returns `{"status": "ok"}`
- [ ] Indeed search returns jobs or structured error
- [ ] Google Jobs search returns jobs or structured error  
- [ ] LinkedIn search returns jobs or authentication error
- [ ] Missing parameters return 400 with details
- [ ] Invalid API key returns 401
- [ ] Chat interface shows detailed error messages
- [ ] Console logs show debugging information
- [ ] Unit tests pass: `npm run test`

## Troubleshooting

### Check Browser Service Logs

```bash
# If using Railway CLI
railway logs

# Or check the service directly
curl -s https://claude-agent-production.up.railway.app/health
```

### Verify Environment Variables

Ensure these are set in the browser service:
- `API_KEY=your-api-key-here`
- `NODE_ENV=production`
- `PORT=3001`

### Test Local Development

To test locally:

1. Start browser service: `cd browser-service && npm run dev`
2. Update `.env.local`: `BROWSER_SERVICE_URL=http://localhost:3001`
3. Run tests: `npm run test`
4. Test chat interface: `npm run dev`

## Performance Expectations

- **Health check**: < 1 second
- **Job search**: 10-30 seconds (due to browser automation)
- **Error responses**: < 5 seconds
- **Timeout**: 30 seconds maximum

## Success Criteria

The job search functions are working correctly when:

1. ✅ All three search functions return structured responses
2. ✅ Error messages are descriptive and actionable
3. ✅ Console logs provide debugging context
4. ✅ Chat interface shows meaningful feedback
5. ✅ Unit tests validate error handling paths
6. ✅ Manual testing confirms expected behavior
