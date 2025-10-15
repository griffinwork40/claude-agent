# Browser Service Testing & Deployment Guide

This guide walks you through testing the browser automation service locally and deploying to production.

## Phase 1: Local Testing

### Step 1: Set Up Browser Service

1. **Navigate to browser service directory:**
```bash
cd browser-service
```

2. **Install dependencies:**
```bash
npm install
```

3. **Install Playwright browsers:**
```bash
npx playwright install chromium
```

4. **Start the browser service:**
```bash
npm run dev
```

You should see:
```
🚀 Browser service running on http://localhost:3001
📝 API Key: Set
🔧 Environment: development
```

### Step 2: Test Browser Service Endpoints

**Terminal 2 - Test health check:**
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "browser-automation",
  "timestamp": "2025-10-11T..."
}
```

**Test Indeed search:**
```bash
curl -X POST http://localhost:3001/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key-12345" \
  -d '{"keywords":"software engineer","location":"San Francisco"}'
```

Expected: JSON response with array of job listings.

### Step 3: Update Next.js Environment

1. **Add to your root `.env.local`:**
```bash
# Browser Service (Local Testing)
BROWSER_SERVICE_URL=http://localhost:3001
BROWSER_SERVICE_API_KEY=test-key-12345
```

2. **Verify the file exists:**
```bash
# From project root
grep BROWSER_SERVICE .env.local
```

### Step 4: Test End-to-End Flow

1. **Terminal 1: Keep browser service running** (from Step 1)

2. **Terminal 2: Start Next.js dev server:**
```bash
# From project root
npm run dev
```

3. **Open browser:**
   - Navigate to http://localhost:3000/agent
   - Log in if needed
   - Send a message: "Search for frontend developer jobs in San Francisco"

4. **Expected behavior:**
   - Claude receives the message
   - Calls `search_jobs_indeed` tool
   - Your Next.js app calls `http://localhost:3001/api/search-indeed`
   - Browser service scrapes Indeed
   - Results flow back to Claude
   - Claude presents job listings

5. **Check logs:**
   - **Terminal 1** (browser service): Should show `🔍 Indeed search request...`
   - **Terminal 2** (Next.js): Should show tool execution logs

### Troubleshooting Local Testing

**Issue: 401 Unauthorized**
- Check API key matches in both services
- Verify `.env.local` has `BROWSER_SERVICE_API_KEY=test-key-12345`

**Issue: Connection refused**
- Ensure browser service is running on port 3001
- Check for port conflicts: `lsof -i :3001`

**Issue: No jobs returned**
- Indeed/LinkedIn may have changed selectors
- Check browser service logs for actual error
- Try with `headless: false` to see what's happening

## Phase 2: Testing with ngrok (Optional)

If you want to test your deployed Vercel app against local browser service:

### Step 1: Install ngrok
```bash
brew install ngrok
# or download from https://ngrok.com/download
```

### Step 2: Expose Browser Service
```bash
# Terminal 1: Run browser service
cd browser-service && npm run dev

# Terminal 2: Start ngrok
ngrok http 3001
```

Copy the ngrok URL (e.g., `https://abc123.ngrok-free.app`)

### Step 3: Update Vercel Environment
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Add/update:
   - `BROWSER_SERVICE_URL` = `https://abc123.ngrok-free.app`
   - `BROWSER_SERVICE_API_KEY` = `test-key-12345`
3. Redeploy or wait for automatic deployment

### Step 4: Test Production → Local
- Visit your Vercel deployment
- Test job search functionality
- Watch ngrok terminal for incoming requests
- Check browser service logs

**Note:** ngrok free tier has request limits and URL changes on restart. For extended testing, consider ngrok paid ($8/month) for persistent URLs.

## Phase 3: Production Deployment to Railway

### Step 1: Prepare Repository

1. **Create separate Git repo for browser service:**
```bash
cd browser-service
git init
git add .
git commit -m "Initial browser automation service"
```

2. **Push to GitHub:**
```bash
# Create a new repo on GitHub first, then:
git remote add origin https://github.com/yourusername/job-browser-service.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Railway

1. **Go to Railway:**
   - Visit https://railway.app
   - Sign up/log in with GitHub

2. **Create new project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `job-browser-service` repo
   - Railway will auto-detect the Dockerfile

3. **Configure environment variables:**
   - In Railway dashboard → Variables tab
   - Add: `API_KEY` = `<generate-a-secure-random-key>`
   - Example secure key: `sk_live_$(openssl rand -base64 32)`

4. **Configure persistent storage (for LinkedIn sessions):**
   - In Railway dashboard → Volumes tab
   - Click "Add Volume"
   - Mount path: `/app/linkedin-sessions`
   - Save

5. **Deploy:**
   - Railway will build and deploy automatically
   - First build takes ~5-10 minutes (Playwright deps are large)
   - Watch logs for any errors

6. **Get deployment URL:**
   - In Railway dashboard → Settings → Domains
   - Railway generates: `https://your-app.up.railway.app`
   - Or add custom domain if you prefer

### Step 3: Test Railway Deployment

```bash
# Test health check
curl https://your-app.up.railway.app/health

# Test Indeed search (use your actual API key)
curl -X POST https://your-app.up.railway.app/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secure-key" \
  -d '{"keywords":"software engineer","location":"San Francisco"}'
```

### Step 4: Update Vercel Environment

1. **Go to Vercel dashboard:**
   - Your project → Settings → Environment Variables

2. **Update/add variables:**
   - `BROWSER_SERVICE_URL` = `https://your-app.up.railway.app`
   - `BROWSER_SERVICE_API_KEY` = `your-secure-key` (same as Railway API_KEY)

3. **Apply to environments:**
   - Select: Production, Preview, Development
   - Save

4. **Redeploy Vercel:**
   - Go to Deployments tab
   - Click "..." → Redeploy
   - Or push a new commit to trigger deployment

### Step 5: Test Production

1. **Visit your Vercel deployment**
2. **Test job search:** "Find software engineer jobs in Austin"
3. **Check Railway logs:**
   - Railway dashboard → Deployments → Logs
   - Should see incoming requests

## Monitoring & Maintenance

### Railway Dashboard
- **Metrics:** Monitor CPU, memory, network usage
- **Logs:** View real-time logs for debugging
- **Alerts:** Set up notifications for downtime

### Common Issues

**LinkedIn session expires:**
- Sessions last ~7 days
- Symptom: LinkedIn searches fail with "Login required"
- Solution: Need to implement re-authentication flow (future enhancement)

**Memory limits:**
- Railway free tier: 512MB
- If hitting limits, upgrade to 1GB: Railway dashboard → Resources
- Playwright can use 300-500MB per browser instance

**Selector changes:**
- Indeed/LinkedIn change HTML frequently
- Symptom: "Selector not found" errors
- Solution: Update selectors in `browser-service/src/browser-tools.ts`

**Rate limiting:**
- Job boards may rate limit your IP
- Solution: Add delays between requests, rotate user agents

## Cost Breakdown

**Railway (Production):**
- Free tier: 500 hours/month compute + 512MB RAM
- Paid: ~$5-10/month for 1GB RAM always-on instance
- Volume storage: Included

**Vercel (No change):**
- Existing free/paid tier continues

**ngrok (Optional, for testing):**
- Free: Random URLs, limited requests
- Paid: $8/month for persistent URLs

**Total estimated:** $0 (free tiers) to $10-15/month (production)

## Rollback Plan

If something goes wrong:

1. **Quick fix - Revert Vercel env vars:**
   - Remove `BROWSER_SERVICE_URL` and `BROWSER_SERVICE_API_KEY`
   - This will break browser tools, but app stays up
   - Claude will gracefully handle tool failures

2. **Restore old implementation:**
   - In `lib/browser-tools.ts`, restore from git history
   - Redeploy Vercel

3. **Keep both running:**
   - You can keep Railway service running
   - Switch between old/new via environment variables
   - No need to tear down infrastructure

## Next Steps After Deployment

1. **Add rate limiting:** Prevent API abuse
2. **Implement LinkedIn re-auth:** Handle expired sessions automatically
3. **Add monitoring:** Set up error tracking (Sentry, etc.)
4. **Optimize performance:** Cache job results, implement job queues
5. **Scale if needed:** Add more Railway instances behind load balancer

## Questions?

If you hit issues:
1. Check Railway logs first
2. Check Vercel logs
3. Verify environment variables match
4. Test endpoints with curl
5. Check browser service README.md for API docs

