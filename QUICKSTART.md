# Onboarding Agent - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Database Setup
Run the migration in your Supabase dashboard:
```sql
-- Copy and run: supabase/migrations/20250315_create_user_profiles.sql
```

### Step 2: Environment Variables
Add to your `.env.local`:
```bash
ANTHROPIC_API_KEY=sk-ant-...           # Required for resume parsing
NEXT_PUBLIC_SUPABASE_URL=https://...   # Your Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...      # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=...          # Supabase service role key
```

### Step 3: Install & Run
```bash
npm install
npm run dev
```

### Step 4: Test It Out
1. Visit http://localhost:3000/signup
2. Create a test account
3. You'll be redirected to `/onboarding`
4. Upload a sample resume (PDF, DOCX, or TXT)
5. Chat with the AI to complete your profile
6. Get redirected to the agent dashboard

### Step 5: Verify
Check your profile data:
```bash
curl http://localhost:3000/api/user/export-profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎯 What You Get

- ✅ AI-powered resume parsing
- ✅ Conversational onboarding chat
- ✅ Automatic user profile creation
- ✅ Context injection into all agents
- ✅ Secure data storage
- ✅ Export capability

## 📋 Files Created

**Database:**
- `supabase/migrations/20250315_create_user_profiles.sql`

**API:**
- `app/api/onboarding/upload-resume/route.ts`
- `app/api/onboarding/chat/route.ts`
- `app/api/user/export-profile/route.ts`

**Frontend:**
- `app/onboarding/page.tsx`

**Libraries:**
- `lib/user-data-compiler.ts`

**Updates:**
- `middleware.ts` - Onboarding redirect
- `lib/claude-agent.ts` - Context injection

## 🧪 Run Tests
```bash
npx tsx scripts/test-onboarding.ts
```

Expected output:
```
✓ JSON compilation successful
✓ All required fields present
✓ Context generation successful
ALL TESTS PASSED ✓
```

## 📚 Full Documentation

- **`ONBOARDING.md`** - Complete feature documentation
- **`IMPLEMENTATION_SUMMARY.md`** - Implementation details
- **`WARP.md`** - Development commands

## 🐛 Troubleshooting

**Issue:** Resume upload fails
- **Fix:** Check ANTHROPIC_API_KEY is set

**Issue:** Redirect loop
- **Fix:** Verify user_profiles table exists and has data

**Issue:** Context not in agent
- **Fix:** Check getUserContextForPrompt() is working

## ✨ That's It!

You now have a fully functional onboarding agent that:
1. Parses resumes with AI
2. Collects user data via chat
3. Injects context into all agents
4. Provides personalized job searches

---

**Need help?** Check the full docs in `ONBOARDING.md`
