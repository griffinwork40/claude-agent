# Railway Deployment Guide - Browser Service

## Prerequisites

- Railway account (sign up at https://railway.app with GitHub)
- Your browser service code (already created in `browser-service/`)
- GitHub account

## Step-by-Step Deployment

### Step 1: Prepare the Browser Service for Deployment

The code is already ready! You have:
- ✅ `browser-service/Dockerfile` - Container definition
- ✅ `browser-service/railway.json` - Railway configuration
- ✅ `browser-service/src/server.ts` - Express API
- ✅ `browser-service/package.json` - Dependencies

### Step 2: Create a Separate Git Repository

Railway deploys from Git repositories. You have two options:

#### Option A: Create Separate Repo (Recommended for Production)

```bash
# Navigate to browser service
cd browser-service

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial browser automation service for Railway deployment"

# Create new repo on GitHub
# Go to https://github.com/new
# Name it: job-browser-service
# Don't initialize with README (we already have files)

# Add remote and push
git remote add origin https://github.com/griffinwork40/job-browser-service.git
git branch -M main
git push -u origin main
```

#### Option B: Use Existing Repo (Monorepo - Simpler for Testing)

Railway can deploy a subdirectory from your main repo:

```bash
# From project root
cd /Users/griffinlong/Projects/personal_projects/claude-agent

# Add and commit the browser-service directory
git add browser-service/
git commit -m "Add browser automation service for Railway deployment"

# Push to your current branch
git push origin feat/split-browser-tool
```

### Step 3: Deploy to Railway

1. **Go to Railway**
   - Visit https://railway.app
   - Click "Login" → Sign in with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Authorize Railway to access your GitHub repos (if first time)

3. **Select Repository**
   - **Option A users**: Select `job-browser-service` repo
   - **Option B users**: Select `claude-agent` repo

4. **Configure Root Directory** (Option B users only)
   - After selecting repo, Railway will detect the Dockerfile
   - If using monorepo, set root directory to `browser-service`
   - Settings → Service → Root Directory: `browser-service`

5. **Railway Auto-Detects**
   - Railway will automatically detect the `Dockerfile`
   - Build configuration is set by `railway.json`

### Step 4: Configure Environment Variables

1. **In Railway Dashboard**
   - Click on your deployed service
   - Go to "Variables" tab

2. **Add Environment Variable**
   ```
   API_KEY = <generate-secure-key>
   ```

3. **Generate Secure API Key**
   ```bash
   # Option 1: Use openssl
   openssl rand -base64 32
   
   # Option 2: Use Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   
   # Example output: X7vK9mP2nQ8wR5tY3zL6cA1hF4jN0sU9vD8xW2qH5iA=
   ```

4. **Copy this key** - you'll need it for Vercel later

### Step 5: Configure Persistent Storage (For LinkedIn Sessions)

1. **In Railway Dashboard**
   - Go to your service
   - Click "Volumes" tab
   - Click "Add Volume"

2. **Configure Volume**
   - Mount Path: `/app/linkedin-sessions`
   - This ensures LinkedIn sessions persist across deployments

3. **Save**

### Step 6: Deploy

1. **Railway Auto-Deploys**
   - After adding variables, Railway automatically builds and deploys
   - First build takes 5-10 minutes (Playwright dependencies are large)

2. **Monitor Deployment**
   - Go to "Deployments" tab
   - Click on the active deployment
   - Watch the build logs

3. **Wait for "Success"**
   - Build logs will show:
     ```
     Building with Dockerfile
     Installing Playwright dependencies...
     ✓ Build completed
     ✓ Deployment live
     ```

### Step 7: Get Your Railway URL

1. **In Railway Dashboard**
   - Go to "Settings" tab
   - Scroll to "Domains" section
   - Railway auto-generates a URL like:
     ```
     https://job-browser-service-production.up.railway.app
     ```

2. **Optional: Add Custom Domain**
   - Click "Add Domain"
   - Add your custom domain (e.g., `browser.yourdomain.com`)
   - Configure DNS as Railway instructs

### Step 8: Test Railway Deployment

```bash
# Test health check
curl https://your-app.up.railway.app/health

# Expected response:
# {"status":"ok","service":"browser-automation","timestamp":"..."}

# Test Indeed search (use your actual API key)
curl -X POST https://your-app.up.railway.app/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -d '{"keywords":"software engineer","location":"San Francisco"}'

# Should return job listings
```

### Step 9: Update Vercel Environment Variables

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com
   - Select your project (claude-agent/enlist)

2. **Go to Settings → Environment Variables**

3. **Add/Update Variables**
   ```
   BROWSER_SERVICE_URL = https://your-app.up.railway.app
   BROWSER_SERVICE_API_KEY = X7vK9mP2nQ8wR5tY3zL6cA1hF4jN0sU9vD8xW2qH5iA=
   ```
   (Use your actual Railway URL and API key from Step 4)

4. **Apply to All Environments**
   - Check: Production
   - Check: Preview
   - Check: Development (optional)

5. **Save**

### Step 10: Redeploy Vercel

1. **Go to Deployments Tab** in Vercel
2. **Click on Latest Deployment** → "..." menu → "Redeploy"
3. **Or** push a new commit to trigger deployment

### Step 11: Test Production

1. **Visit Your Vercel App**
   - Go to your production URL (e.g., `https://jobenlist.com`)

2. **Login and Test**
   - Login to your account
   - Go to `/agent` page
   - Send message: "Search for software engineer jobs in Austin"

3. **Verify**
   - Job listings should appear
   - Check Railway logs for incoming requests
   - Check Vercel logs for outgoing requests

## Monitoring & Debugging

### Railway Logs

```bash
# View live logs
railway logs

# Or in Railway Dashboard:
# Click service → Deployments → Active deployment → View Logs
```

### Common Issues

**Build fails:**
- Check Railway logs for specific error
- Usually missing dependencies in Dockerfile
- Verify `npm run build` works locally

**Service crashes:**
- Check if `API_KEY` environment variable is set
- Check memory limits (upgrade to 1GB if needed)
- View crash logs in Railway dashboard

**API returns errors:**
- Verify API key matches between Railway and Vercel
- Check Railway logs for actual error messages
- Test endpoint with curl from command line

**Playwright issues:**
- Should work out of the box in Docker
- If issues, check Dockerfile includes all Chromium dependencies
- Railway's Linux environment doesn't have macOS sandbox issues

## Updating the Service

### To deploy updates:

```bash
# Make changes to browser-service/
cd browser-service

# Commit changes
git add .
git commit -m "Update browser service"

# Push to GitHub
git push

# Railway auto-deploys on push!
# Monitor deployment in Railway dashboard
```

## Costs

**Railway Pricing (2025):**
- Free tier: 500 hours/month compute
- This equals ~20 days of uptime (plenty for testing)
- Production: ~$5-10/month for always-on 1GB instance
- Volume storage: Included

**Start with free tier**, upgrade when needed.

## Quick Commands Reference

```bash
# Generate secure API key
openssl rand -base64 32

# Test Railway health
curl https://your-app.up.railway.app/health

# Test Indeed search
curl -X POST https://your-app.up.railway.app/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"keywords":"software engineer","location":"remote"}'

# View Railway logs (if CLI installed)
railway logs
```

## Success Criteria

You know it worked when:
- ✅ Railway build completes successfully
- ✅ Health endpoint responds
- ✅ API test returns job listings
- ✅ Vercel app can search for jobs
- ✅ LinkedIn sessions persist across deployments

## Troubleshooting

**Error: "API_KEY environment variable is not set"**
- Add API_KEY in Railway Variables tab

**Error: "EADDRINUSE: address already in use"**
- Railway handles this automatically, shouldn't happen

**Playwright crashes:**
- Upgrade Railway instance to 1GB RAM
- Settings → Resources → Memory: 1GB

**Can't access Railway URL:**
- Check deployment status (should be "Active")
- Verify domain in Settings → Domains
- Test health endpoint first

## Next Steps After Deployment

1. Monitor Railway usage (free tier limits)
2. Set up Railway alerts for downtime
3. Add rate limiting to API endpoints
4. Implement LinkedIn session re-authentication
5. Add monitoring/logging (Sentry, LogRocket, etc.)

---

**Need help?** Check Railway logs or visit Railway Discord: https://discord.gg/railway

