# Quick Start - Browser Service

## 30-Second Setup

```bash
# Install dependencies
npm install

# Install Playwright browser
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
- `PORT` - Port to run on (default: 3001)

For local dev, the defaults work fine. For production, set a secure API_KEY.

## Next Steps

1. **Local testing:** Keep this service running, start Next.js app in another terminal
2. **Production:** Deploy to Railway (see ../NEXT_STEPS.md)

## API Endpoints

- `GET /health` - Health check (no auth)
- `POST /api/search-indeed` - Search Indeed jobs
- `POST /api/search-linkedin` - Search LinkedIn jobs  
- `POST /api/job-details` - Get job details
- `POST /api/apply-to-job` - Apply to job

All except `/health` require Bearer token authentication.

## Documentation

- **Full README:** `README.md` (this directory)
- **Testing guide:** `../TESTING_GUIDE.md`
- **Next steps:** `../NEXT_STEPS.md`

