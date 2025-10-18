# Quick Start - Browser Service

## 30-Second Setup

```bash
# Install dependencies
npm install

# Install Playwright browser (for job applications only)
npx playwright install chromium

# Start the service
npm run dev
```

The service will run on **http://localhost:3001**

## Quick Test

```bash
# In a new terminal
./test-service.sh
```

Expected: All tests pass ✓

## Environment

The service uses `.env.local`:
- `API_KEY` - Authentication key for API requests
- `SERPAPI_API_KEY` - SerpAPI key for job search (get from serpapi.com)
- `PORT` - Port to run on (default: 3001)

**Important:** For job search to work, you need a SerpAPI key. Get one at serpapi.com (100 free searches/month).

## Next Steps

1. **Local testing:** Keep this service running, start Next.js app in another terminal
2. **Production:** Deploy to Railway (see ../NEXT_STEPS.md)

## API Endpoints

**Job Search (API-based):**
- `GET /health` - Health check (no auth)
- `POST /api/search-serp` - Search Google Jobs via SerpAPI
- `POST /api/search-indeed` - Search Indeed jobs via SerpAPI + Remotive
- `POST /api/search-google` - Search Google Jobs via SerpAPI + Remotive
- `POST /api/search-linkedin` - Returns manual LinkedIn search link

**Job Applications (Browser automation):**
- `POST /api/job-details` - Get job details
- `POST /api/apply-to-job` - Apply to job on company website
- `POST /api/find-careers-page` - Find company careers page
- `POST /api/extract-company-url` - Extract company application URL

All except `/health` require Bearer token authentication.

## Documentation

- **Full README:** `README.md` (this directory)
- **Testing guide:** `../TESTING_GUIDE.md`
- **Next steps:** `../NEXT_STEPS.md`

