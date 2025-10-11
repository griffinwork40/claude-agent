# Next Steps - Playwright Migration

## 🎯 What's Been Done

✅ **Architecture migrated** - Browser automation separated from Next.js serverless
✅ **Browser service created** - Express API with Playwright in `browser-service/`
✅ **Client updated** - `lib/browser-tools.ts` now uses HTTP instead of Playwright
✅ **Deployment ready** - Dockerfile and Railway config created
✅ **Documentation complete** - Testing guide and implementation summary written

## 🚀 What You Need to Do

### Option 1: Local Testing Only (Recommended First)

**Time: ~15 minutes**

1. **Start browser service:**
```bash
cd browser-service
npm install
npx playwright install chromium
npm run dev
```

Expected output:
```
🚀 Browser service running on http://localhost:3001
📝 API Key: Set
🔧 Environment: development
```

2. **Test the service (new terminal):**
```bash
cd browser-service
./test-service.sh
```

Expected: All tests pass ✓

3. **Start Next.js app (new terminal):**
```bash
# From project root
npm run dev
```

4. **Test end-to-end:**
   - Open: http://localhost:3000/agent
   - Login if needed
   - Send: "Search for frontend developer jobs in San Francisco"
   - Expected: Claude calls tool → scraping happens → jobs returned

**If it works:** You're done for local testing! 🎉

---

### Option 2: Production Deployment

**Time: ~45 minutes**

Only do this after local testing succeeds.

#### Step 1: Deploy to Railway (30 min)

1. **Create GitHub repo for browser service:**
```bash
cd browser-service
git init
git add .
git commit -m "Initial browser automation service"
```

2. **Push to GitHub:**
   - Create new repo at https://github.com/new
   - Name it: `job-browser-service`
   - Run:
```bash
git remote add origin https://github.com/YOUR_USERNAME/job-browser-service.git
git branch -M main
git push -u origin main
```

3. **Deploy on Railway:**
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub repo"
   - Select `job-browser-service`
   - Railway detects Dockerfile automatically
   
4. **Configure Railway:**
   - **Variables tab:**
     - Add: `API_KEY` = (generate secure key - see below)
   - **Volumes tab:**
     - Click "Add Volume"
     - Mount path: `/app/linkedin-sessions`
   - **Deploy:**
     - Watch logs, first build takes 5-10 minutes
   
5. **Generate secure API key:**
```bash
openssl rand -base64 32
# Example output: X7vK9mP2nQ8wR5tY3zL6cA1hF4jN0sU9
```

6. **Get Railway URL:**
   - Settings → Domains
   - Copy URL: `https://your-app.up.railway.app`

7. **Test Railway deployment:**
```bash
# Replace with your actual URL and API key
curl https://your-app.up.railway.app/health
```

Expected: `{"status":"ok",...}`

#### Step 2: Update Vercel (5 min)

1. **Go to Vercel dashboard:**
   - Project → Settings → Environment Variables

2. **Add/update variables:**
   - `BROWSER_SERVICE_URL` = `https://your-app.up.railway.app`
   - `BROWSER_SERVICE_API_KEY` = `X7vK9mP2nQ8wR5tY3zL6cA1hF4jN0sU9` (your secure key)
   - Apply to: **All environments** (Production, Preview, Development)

3. **Redeploy:**
   - Deployments tab → "..." → Redeploy
   - Or push a commit to trigger deployment

4. **Test production:**
   - Visit your Vercel URL
   - Go to /agent
   - Test job search
   - Check Railway logs for requests

**If it works:** Production migration complete! 🎉

---

### Option 3: Test with ngrok (Optional)

**Time: ~10 minutes**

Test your deployed Vercel app against local browser service.

1. **Install ngrok:**
```bash
brew install ngrok
# or download from https://ngrok.com
```

2. **Run browser service + ngrok:**
```bash
# Terminal 1
cd browser-service && npm run dev

# Terminal 2
ngrok http 3001
# Copy URL: https://abc123.ngrok-free.app
```

3. **Update Vercel:**
   - Environment Variables:
     - `BROWSER_SERVICE_URL` = `https://abc123.ngrok-free.app`
     - `BROWSER_SERVICE_API_KEY` = `test-key-12345`
   - Redeploy

4. **Test:**
   - Visit Vercel deployment
   - Watch ngrok terminal for requests
   - Check browser service logs

---

## 📊 Current TODO Status

- ✅ Create browser service structure
- ✅ Update Next.js client code  
- ✅ Create Docker and Railway configs
- ⏭️ **Local testing** ← YOU ARE HERE
- ⏭️ Railway deployment (optional)
- ⏭️ Vercel env update (optional)

## 🆘 Troubleshooting

### Service won't start
```bash
# Check port conflict
lsof -i :3001
kill -9 <PID>  # if something is using port 3001
```

### Authentication fails
- Verify API key in `.env.local` matches
- Check: `grep BROWSER_SERVICE .env.local`

### No jobs returned
- Check browser service logs
- Indeed/LinkedIn may have changed selectors
- Try with `headless: false` in browser-tools.ts

### Railway build fails
- Check Railway logs
- Usually missing dependencies
- Verify Dockerfile is correct

## 📚 Documentation Reference

- **Full testing guide:** `TESTING_GUIDE.md`
- **Implementation details:** `IMPLEMENTATION_SUMMARY.md`
- **Browser service API:** `browser-service/README.md`
- **Original research:** `playwright-production-migration.plan.md`

## ✨ Quick Commands

```bash
# Test browser service health
curl http://localhost:3001/health

# Test Indeed search
curl -X POST http://localhost:3001/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key-12345" \
  -d '{"keywords":"software engineer","location":"remote"}'

# Run all tests
cd browser-service && ./test-service.sh

# Start everything (3 terminals)
# Terminal 1: cd browser-service && npm run dev
# Terminal 2: npm run dev (from root)
# Terminal 3: Visit http://localhost:3000/agent
```

## 🎉 Success Criteria

You know it's working when:
- ✓ Browser service starts on port 3001
- ✓ Health check returns OK
- ✓ Test script passes all checks
- ✓ Next.js app connects to browser service
- ✓ Claude can search for jobs via tools
- ✓ Job results appear in chat

## 💰 Cost Summary

**Local testing:** $0

**Production:**
- Railway: $0 (free tier) → $5-10/month (production)
- Vercel: No change
- **Total:** $0-10/month

---

**Need help?** Check `TESTING_GUIDE.md` for detailed step-by-step instructions.

**Ready to start?** Run:
```bash
cd browser-service && npm install && npm run dev
```

