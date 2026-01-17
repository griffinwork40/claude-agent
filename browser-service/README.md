# Browser Automation Service

Separate HTTP service for API-based job search and Playwright-based browser automation for job applications. Uses SerpAPI and Remotive APIs for job discovery, with browser automation only for applying to jobs on company websites.

## Architecture

This service provides:
- **API-based job search** using SerpAPI (Google Jobs) and Remotive API
- **Browser automation** for applying to jobs on company websites (not for job search)
- REST API allowing the main Next.js app to offload browser automation to a dedicated service

## Local Development

### Prerequisites
- Node.js 20+
- npm

### Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install chromium
```

3. Create `.env.local`:
```bash
cp .env.local.example .env.local
# Edit .env.local and set your API_KEY and SERP_API_KEY
```

4. Run the service:
```bash
npm run dev
```

The service will run on http://localhost:3001

### Testing

Test the health endpoint:
```bash
curl http://localhost:3001/health
```

Test Indeed search (requires API key):
```bash
curl -X POST http://localhost:3001/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{"keywords":"frontend developer","location":"San Francisco"}'
```

## API Endpoints

All endpoints except `/health` require Bearer token authentication.

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "browser-automation",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### POST /api/search-serp
Search for jobs using the Google SERP API integration. Returns structured job opportunities sourced from Google Jobs along with
manual fallback results when the API is unavailable.

**Request:**
```json
{
  "keywords": "frontend developer",
  "location": "Remote",
  "experience_level": "mid",
  "remote": true
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "serp_1700000000000_0",
      "title": "Frontend Developer",
      "company": "Tech Corp",
      "location": "Remote",
      "application_url": "https://www.example.com/job/apply",
      "source": "google",
      "status": "discovered",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

### POST /api/search-indeed
Search for jobs on Indeed.com.

**Request:**
```json
{
  "keywords": "frontend developer",
  "location": "San Francisco",
  "experience_level": "mid",
  "remote": true
}
```

**Response:**
```json
{
  "success": true,
  "data": [/* JobOpportunity[] */]
}
```

### POST /api/search-google
Search for jobs on Google Jobs (aggregated from multiple sources).

**Request:**
```json
{
  "keywords": "frontend developer",
  "location": "San Francisco",
  "experience_level": "mid",
  "remote": true
}
```

**Response:**
```json
{
  "success": true,
  "data": [/* JobOpportunity[] */]
}
```

### POST /api/search-linkedin
Search for jobs on LinkedIn (requires authenticated session).

**Request:**
```json
{
  "keywords": "frontend developer",
  "location": "San Francisco",
  "experience_level": "mid",
  "remote": true,
  "userId": "user-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": [/* JobOpportunity[] */]
}
```

### POST /api/job-details
Get detailed information about a specific job.

**Request:**
```json
{
  "job_url": "https://www.indeed.com/viewjob?jk=..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "description": "...",
    "skills": ["JavaScript", "React", "TypeScript"],
    "salary": "$120k - $160k",
    "application_url": "..."
  }
}
```

### POST /api/apply-to-job
Apply to a job using user profile data.

**Request:**
```json
{
  "job_url": "https://www.indeed.com/viewjob?jk=...",
  "user_profile": {
    "personal_info": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "555-1234",
      "location": "San Francisco, CA"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Application submitted successfully",
    "details": {}
  }
}
```

## Production Deployment

### Railway

1. Push to GitHub:
```bash
git init
git add .
git commit -m "Initial browser service"
git remote add origin <your-repo-url>
git push -u origin main
```

2. Deploy on Railway:
   - Go to https://railway.app
   - "New Project" → "Deploy from GitHub repo"
   - Select this repo
   - Railway auto-detects Dockerfile
   - Add environment variables:
     - `API_KEY=<secure-random-key>`
     - `SERP_API_KEY=<serp-api-key>`
   - Deploy!

3. Configure persistent storage (for LinkedIn sessions):
   - In Railway dashboard → Variables
   - Add volume mount: `/app/linkedin-sessions`

4. Get deployment URL:
   - Railway generates: `https://your-app.up.railway.app`

### Environment Variables

- `API_KEY`: Authentication key for API requests (required)
- `SERP_API_KEY`: Google SERP API key used for Google Jobs integration (required for `/api/search-serp`)
- `PORT`: Port to run the service on (default: 3001)
- `NODE_ENV`: Environment mode (development/production)

## LinkedIn Session Management

LinkedIn requires authentication. On first LinkedIn search for a user:
1. Browser will open in non-headless mode (local dev)
2. Manually log in to LinkedIn
3. Session is saved to `./linkedin-sessions/{userId}-linkedin.json`
4. Subsequent requests reuse the session

**Note:** In production, ensure the `linkedin-sessions` directory is on persistent storage (Railway volume).

## Debugging

View logs:
```bash
# Local
npm run dev

# Railway
railway logs
```

Common issues:
- **401 Unauthorized**: Check API_KEY matches between service and client
- **LinkedIn login required**: Session expired, need to re-authenticate
- **Selector not found**: Job board HTML changed, update selectors in browser-tools.ts

## Security

- Always use strong, random API keys
- Rotate API keys periodically
- Consider adding rate limiting for production
- Never commit `.env.local` or session files to git

## Cost Estimate

Railway hosting:
- Free tier: 500 hours/month (sufficient for testing)
- Production: $5-10/month for 1GB RAM instance

