# Onboarding Agent Documentation

## Overview

The onboarding agent is an AI-powered chatbot that runs after account creation. It helps new users upload their resume, extracts their personal information, skills, and experience, and compiles this data into a structured JSON format that can be injected into the system prompts of other agents.

## Architecture

### 1. Database Schema

**Table: `user_profiles`**
- Stores extracted user profile data
- Fields:
  - `personal_info` (jsonb): name, email, phone, location
  - `experience` (jsonb): skills, years_experience, previous_roles
  - `preferences` (jsonb): job_types, locations, salary_range, remote_work
  - `resume_text` (text): raw resume content
  - `resume_path` (text): original filename
  - `onboarding_completed` (boolean): completion status
  - `onboarding_completed_at` (timestamptz): completion timestamp

**Migration:** `supabase/migrations/20250315_create_user_profiles.sql`

### 2. API Endpoints

#### `/api/onboarding/upload-resume` (POST)
- **Purpose:** Upload and parse resume files
- **Accepts:** PDF, DOCX, TXT files (max 5MB)
- **Process:**
  1. Validates file type and size
  2. Extracts text from file
  3. Uses Claude to parse structured data
  4. Saves to `user_profiles` table
- **Returns:** Parsed data including personal_info, experience, education, summary

#### `/api/onboarding/chat` (POST)
- **Purpose:** Streaming chat interface for onboarding
- **Process:**
  1. Retrieves user profile data
  2. Uses Claude to ask follow-up questions
  3. Streams responses in real-time
  4. Marks onboarding complete when finished
- **Returns:** Server-sent events (SSE) stream

#### `/api/user/export-profile` (GET)
- **Purpose:** Export user profile as JSON
- **Query Params:** `save=true` to save to filesystem
- **Returns:** `user_fname.json` format

### 3. Frontend Components

#### `/app/onboarding/page.tsx`
Multi-step onboarding interface:

**Step 1: Upload Resume**
- File upload with drag-and-drop
- File validation (type, size)
- Processing feedback

**Step 2: Chat Interface**
- Real-time chat with AI assistant
- Ask follow-up questions
- Confirm and complete profile data

**Step 3: Completion**
- Success message
- Auto-redirect to agent dashboard

### 4. Data Compilation System

**Module:** `lib/user-data-compiler.ts`

**Key Functions:**

- `compileUserDataToJSON(profile)` - Converts profile to structured JSON
- `getUserDataJSON(userId)` - Fetches and compiles user data
- `saveUserDataAsFile(userId)` - Saves to `user-data/user_fname.json`
- `getUserContextForPrompt(userId)` - Generates context string for agent prompts
- `hasCompletedOnboarding(userId)` - Checks onboarding status

**Output Format:** `user_fname.json`
```json
{
  "user_id": "...",
  "personal_information": {
    "full_name": "...",
    "email": "...",
    "phone": "...",
    "location": "..."
  },
  "professional_profile": {
    "years_of_experience": 5,
    "skills": ["..."],
    "employment_history": [...]
  },
  "job_search_preferences": {
    "desired_job_types": ["..."],
    "preferred_locations": ["..."],
    "salary_expectations": {
      "minimum": 80000,
      "maximum": 150000,
      "currency": "USD"
    },
    "remote_work_preference": true
  }
}
```

### 5. Middleware Integration

**File:** `middleware.ts`

**Flow:**
1. Check authentication
2. For protected routes (/agent, /dashboard):
   - If not authenticated → redirect to /login
   - If authenticated but onboarding not complete → redirect to /onboarding
   - If onboarding complete → allow access

### 6. Agent Context Injection

**File:** `lib/claude-agent.ts`

**Integration:**
- `getUserContextForPrompt(userId)` is called in `runClaudeAgentStream()`
- User context is appended to system prompt
- Provides agents with personalized user information

**Context Format:**
```
USER PROFILE CONTEXT:
======================

Personal Information:
- Name: John Doe
- Email: john@example.com
- Phone: +1234567890
- Location: San Francisco, CA

Professional Background:
- Years of Experience: 5
- Key Skills: JavaScript, React, Node.js
- Recent Roles: Software Engineer at Company (2020-2025)

Job Search Preferences:
- Desired Roles: Senior Engineer, Tech Lead
- Preferred Locations: San Francisco, Remote
- Salary Range: $120,000 - $180,000
- Remote Work: Yes

Use this information to personalize job searches and applications for the user.
======================
```

## User Flow

1. **Sign Up** → User creates account
2. **Middleware Check** → Redirected to `/onboarding`
3. **Upload Resume** → User uploads PDF/DOCX/TXT file
4. **AI Parsing** → Claude extracts structured data
5. **Chat Review** → AI asks clarifying questions
6. **Complete Profile** → User confirms all information
7. **Onboarding Complete** → Redirected to `/agent` dashboard
8. **Agent Usage** → All agents have access to user profile context

## Testing

### Manual Testing Steps

1. **Create Test Account:**
   ```bash
   # Visit /signup and create a new account
   ```

2. **Upload Resume:**
   - Should redirect to `/onboarding`
   - Upload a test resume (PDF, DOCX, or TXT)
   - Verify parsing results

3. **Complete Chat:**
   - Answer AI questions
   - Confirm profile data
   - Verify redirect to dashboard

4. **Export Profile:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/user/export-profile?save=true
   ```

5. **Verify Context Injection:**
   - Start a chat with job assistant
   - Verify agent has access to your profile data

### Automated Tests

Run the test suite:
```bash
npm run test
```

## Security Considerations

1. **File Upload Security:**
   - Max file size: 5MB
   - Allowed types: PDF, DOCX, TXT only
   - No executable files accepted

2. **Data Privacy:**
   - User data stored in Supabase with RLS policies
   - User can only access their own profile
   - Resume text stored securely

3. **Authentication:**
   - All endpoints require authentication
   - Middleware enforces onboarding completion

## Future Enhancements

1. **Resume Parsing Improvements:**
   - Support for more file formats (Google Docs, RTF)
   - OCR for scanned PDFs
   - Better parsing accuracy with specialized models

2. **Profile Editing:**
   - Allow users to edit profile after onboarding
   - Update preferences without re-uploading resume

3. **Multi-language Support:**
   - Parse resumes in multiple languages
   - Translate profiles for international job searches

4. **Resume Builder:**
   - Generate formatted resumes from profile data
   - Export in multiple formats

5. **LinkedIn Integration:**
   - Import profile from LinkedIn
   - Auto-fill job preferences

## Troubleshooting

**Issue:** Resume parsing fails
- **Solution:** Check if ANTHROPIC_API_KEY is set
- **Solution:** Verify file is not corrupted
- **Solution:** Try uploading as plain text

**Issue:** Onboarding redirect loop
- **Solution:** Check user_profiles table has correct data
- **Solution:** Verify onboarding_completed is set to true

**Issue:** User context not appearing in agent
- **Solution:** Check getUserContextForPrompt() is called
- **Solution:** Verify system prompt includes context

**Issue:** File upload too large
- **Solution:** Compress PDF or convert to text
- **Solution:** Remove images from resume

## Files Created

1. **Database:**
   - `supabase/migrations/20250315_create_user_profiles.sql`

2. **API Routes:**
   - `app/api/onboarding/upload-resume/route.ts`
   - `app/api/onboarding/chat/route.ts`
   - `app/api/user/export-profile/route.ts`

3. **Frontend:**
   - `app/onboarding/page.tsx`

4. **Libraries:**
   - `lib/user-data-compiler.ts`

5. **Updates:**
   - `middleware.ts` (onboarding redirect logic)
   - `lib/claude-agent.ts` (context injection)
   - `.gitignore` (user-data directory)

## Deployment Notes

1. **Environment Variables Required:**
   - `ANTHROPIC_API_KEY` - For resume parsing and chat
   - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key

2. **Database Migration:**
   ```bash
   # Run migration in Supabase dashboard or CLI
   supabase migration up
   ```

3. **File Storage:**
   - Create `user-data/` directory (gitignored)
   - Ensure write permissions for API routes

4. **Build:**
   ```bash
   npm run build
   npm run start
   ```

## Support

For issues or questions, refer to:
- Main project README
- WARP.md for development commands
- Supabase documentation for database queries
