# Resume Gallery Dashboard - Implementation Plan

**Date:** October 16, 2025  
**Goal:** Create an Instagram-style 3-column gallery for managing multiple resumes in `/dashboard`

---

## Design Vision 🎨

### Instagram-Style Resume Gallery
```
┌─────────────────────────────────────────────────────┐
│ Your Resumes                              [+ Upload]│
├─────────────────────────────────────────────────────┤
│  ┌─────┐  ┌─────┐  ┌─────┐                        │
│  │ PDF │  │ PDF │  │ PDF │                        │
│  │ 📄  │  │ 📄  │  │ 📄  │                        │
│  │SWE  │  │Data │  │PM   │                        │
│  └─────┘  └─────┘  └─────┘                        │
│  10/15/25  10/10/25  09/28/25                      │
│                                                     │
│  ┌─────┐  ┌─────┐                                  │
│  │ DOC │  │ PDF │                                  │
│  │ 📄  │  │ 📄  │                                  │
│  │UX   │  │Tech │                                  │
│  └─────┘  └─────┘                                  │
│  09/15/25  08/30/25                                │
└─────────────────────────────────────────────────────┘
```

**On Hover:** Show overlay with View | Download | Delete actions

---

## Current State Analysis

### ✅ What's Working
1. **Resume Upload During Onboarding**
   - Users upload resume in `/onboarding` step 1
   - File is parsed using `pdf-parser.ts` (supports PDF and DOCX)
   - Extracted text is stored in `user_profiles.resume_text`
   - Original file is saved to Supabase Storage (`resumes` bucket)
   - File path stored in `user_profiles.resume_path`

2. **Data Storage (Current)**
   - Table: `user_profiles`
   - Fields:
     - `resume_text`: Parsed text content from PDF/DOCX
     - `resume_path`: Storage path (e.g., `resumes/{userId}/resume.pdf`)
     - `user_id`: Links to auth.users

3. **Existing Infrastructure**
   - Supabase client configured in `lib/supabase.tsx`
   - Authentication handled via `lib/use-auth.ts`
   - Profile fetching already happens in dashboard

### ❌ What's Missing
1. **No Multiple Resume Support**
   - Current schema only stores ONE resume per user
   - Need new table to support multiple resumes
   - Need migration to move existing data

2. **No Resume Gallery UI**
   - Current dashboard only shows Gmail integration card
   - No 3-column grid layout for resumes
   - No thumbnail/card view

3. **No CRUD Operations**
   - Can't upload additional resumes after onboarding
   - Can't delete individual resumes
   - Can't view/download from dashboard

---

## Implementation Plan

### Phase 1: Database Schema Migration
**File:** `supabase/migrations/YYYYMMDD_create_resumes_table.sql` (NEW)

**New Table: `resumes`**
```sql
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,              -- e.g., "Software_Engineer_Resume.pdf"
  file_path TEXT NOT NULL,              -- e.g., "resumes/{userId}/{timestamp}_{filename}"
  resume_text TEXT,                     -- Parsed content
  file_size INTEGER,                    -- Size in bytes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX idx_resumes_user_id ON resumes(user_id);

-- RLS Policies
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resumes"
  ON resumes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes"
  ON resumes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes"
  ON resumes FOR DELETE
  USING (auth.uid() = user_id);
```

**Data Migration:**
Move existing resume from `user_profiles` to new `resumes` table:
```sql
INSERT INTO resumes (user_id, file_name, file_path, resume_text, created_at)
SELECT 
  user_id,
  COALESCE(
    SUBSTRING(resume_path FROM '[^/]+$'),  -- Extract filename from path
    'resume.pdf'
  ) as file_name,
  resume_path,
  resume_text,
  updated_at
FROM user_profiles
WHERE resume_path IS NOT NULL AND resume_text IS NOT NULL;
```

---

### Phase 2: API Routes for CRUD Operations

#### 2A. List All Resumes
**File:** `app/api/user/resumes/route.ts` (NEW)

**GET Endpoint:**
```typescript
// Returns array of user's resumes with metadata
{
  resumes: [
    {
      id: "uuid",
      file_name: "SWE_Resume.pdf",
      file_size: 125000,
      created_at: "2025-10-15T...",
      preview_text: "First 100 chars...",  // For hover tooltips
      thumbnail_url: null  // Future: PDF thumbnails
    }
  ]
}
```

#### 2B. Upload New Resume
**POST Endpoint:** Same route `app/api/user/resumes/route.ts`

**Flow:**
1. Receive multipart/form-data with PDF/DOCX file
2. Validate file type and size (max 10MB)
3. Parse file using `pdf-parser.ts`
4. Generate unique path: `resumes/{userId}/{timestamp}_{filename}`
5. Upload to Supabase Storage
6. Insert record into `resumes` table
7. Return new resume object

#### 2C. Delete Resume
**File:** `app/api/user/resumes/[id]/route.ts` (NEW)

**DELETE Endpoint:**
1. Verify user owns the resume (RLS handles this)
2. Delete file from Supabase Storage
3. Delete record from `resumes` table
4. Return success

#### 2D. Download Resume
**GET Endpoint:** Same file `app/api/user/resumes/[id]/route.ts`

**Flow:**
1. Fetch resume record from DB
2. Generate signed URL (1 hour expiry)
3. Return signed URL for download

---

### Phase 3: Resume Gallery Component
**File:** `components/dashboard/ResumeGallery.tsx` (NEW)

**UI Structure:**
```tsx
<div className="mt-8">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-xl font-semibold">Your Resumes</h2>
    <button className="btn-primary">+ Upload Resume</button>
  </div>
  
  {/* 3-Column Grid */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {resumes.map(resume => (
      <ResumeCard key={resume.id} resume={resume} />
    ))}
  </div>
  
  {/* Empty State */}
  {resumes.length === 0 && <EmptyState />}
</div>
```

**ResumeCard Component:**
```tsx
<div className="relative aspect-[3/4] group">
  {/* Thumbnail/Icon */}
  <div className="h-full border rounded-lg bg-gradient-to-br from-blue-50 to-white p-6 flex flex-col items-center justify-center">
    <FileText className="h-16 w-16 text-blue-500" />
    <p className="mt-4 text-sm font-medium text-center truncate w-full">
      {resume.file_name}
    </p>
    <p className="text-xs text-gray-500">
      {formatDate(resume.created_at)}
    </p>
  </div>
  
  {/* Hover Overlay with Actions */}
  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
    <button className="icon-btn">👁️ View</button>
    <button className="icon-btn">⬇️ Download</button>
    <button className="icon-btn text-red-500">🗑️ Delete</button>
  </div>
</div>
```

**Features:**
- Responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
- Hover overlay with actions (Instagram-style)
- Smooth animations and transitions
- File type icons (PDF, DOCX)
- Upload date display
- Empty state with "Upload your first resume" CTA

---

### Phase 4: Upload Dialog Component
**File:** `components/dashboard/ResumeUploadDialog.tsx` (NEW)

**Features:**
- Modal dialog (using shadcn Dialog component)
- Drag-and-drop file upload
- File type validation (PDF, DOCX only)
- File size validation (max 10MB)
- Upload progress indicator
- Success/error notifications
- Auto-refresh gallery after upload

**UI:**
```tsx
<Dialog>
  <DialogContent>
    <DialogHeader>Upload Resume</DialogHeader>
    
    <div className="border-2 border-dashed rounded-lg p-8 text-center">
      {isDragging ? (
        <p>Drop file here...</p>
      ) : (
        <>
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <p>Drag & drop or click to upload</p>
          <p className="text-xs text-gray-500">PDF or DOCX, max 10MB</p>
        </>
      )}
    </div>
    
    {uploading && <ProgressBar progress={uploadProgress} />}
  </DialogContent>
</Dialog>
```

---

### Phase 5: Dashboard Integration
**File:** `app/dashboard/page.tsx`

**Changes:**
```tsx
export default async function DashboardPage() {
  // ... existing code ...
  
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">  {/* Wider for gallery */}
      <h1 className="text-2xl font-bold">Dashboard</h1>
      
      {/* Existing Gmail Card */}
      <GmailIntegrationCard ... />
      
      {/* NEW: Resume Gallery */}
      <ResumeGallery userId={session.user.id} />
    </div>
  );
}
```

---

### Phase 6: Testing & Edge Cases

**Test Cases:**
1. ✅ User uploads multiple resumes → All appear in gallery
2. ✅ User hovers on resume card → Actions appear
3. ✅ User clicks View → Opens PDF in new tab
4. ✅ User clicks Download → File downloads correctly
5. ✅ User clicks Delete → Confirmation → File removed
6. ✅ User drags & drops file → Upload works
7. ✅ User uploads invalid file → Error shown
8. ✅ Mobile view → Grid stacks to 1 column
9. ✅ Empty state → Shows helpful message
10. ✅ Loading state → Skeleton cards shown

**Edge Cases:**
- Large files (performance)
- Network failures during upload
- Concurrent uploads
- Deleting while others viewing
- Storage quota limits

---

## File Structure

```
app/
  api/
    user/
      resumes/
        route.ts                    # GET: List all | POST: Upload new
        [id]/
          route.ts                  # GET: Download URL | DELETE: Remove
  dashboard/
    page.tsx                        # Updated with Resume Gallery

components/
  dashboard/
    ResumeGallery.tsx              # Main 3-column grid gallery
    ResumeCard.tsx                 # Individual resume card with hover actions
    ResumeUploadDialog.tsx         # Upload modal with drag-drop

supabase/
  migrations/
    YYYYMMDD_create_resumes_table.sql  # New resumes table + migration
```

---

## Database Schema Changes

### NEW Table: `resumes`
```sql
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,              -- Original filename
  file_path TEXT NOT NULL,              -- Storage path
  resume_text TEXT,                     -- Parsed content for search/preview
  file_size INTEGER,                    -- In bytes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index for performance
  INDEX idx_resumes_user_id (user_id)
);
```

### Migration Strategy
Move existing resume data from `user_profiles` to new `resumes` table, then optionally deprecate old columns

---

## Storage Bucket Configuration

**Bucket:** `resumes`  
**Path Pattern:** `resumes/{userId}/{filename}`  
**Access:** Private (requires signed URLs)  
**Policies:**
- Users can read their own resumes
- Users can upload to their own folder
- Users can delete their own resumes

---

## Dependencies

All required dependencies already installed:
- `@supabase/supabase-js` - Database & Storage
- `pdf-parse` - PDF parsing
- `mammoth` - DOCX parsing
- `shadcn/ui` - UI components
- `lucide-react` - Icons

---

## Timeline Estimate

| Phase | Effort | Files Changed |
|-------|--------|---------------|
| Phase 1: Database Migration | 2 hours | 1 migration file |
| Phase 2: API Routes (CRUD) | 4 hours | 2 new API files |
| Phase 3: Resume Gallery UI | 5 hours | 2 new components |
| Phase 4: Upload Dialog | 3 hours | 1 new component |
| Phase 5: Dashboard Integration | 1 hour | 1 file edit |
| Phase 6: Testing | 3 hours | All files |
| **Total** | **18 hours** | **7 files** |

---

## Success Criteria

- [ ] Multiple resumes supported (not just one)
- [ ] 3-column gallery displays all user resumes
- [ ] Hover on card shows View/Download/Delete actions
- [ ] Upload dialog supports drag-and-drop
- [ ] File validation (type, size) works
- [ ] Delete confirmation prevents accidents
- [ ] Empty state shows "Upload your first resume"
- [ ] Responsive on mobile (1 column), tablet (2 col), desktop (3 col)
- [ ] Smooth animations and transitions
- [ ] No console errors or warnings

---

## Next Steps

1. **Start with Phase 1** - Create database migration
2. Run migration in Supabase
3. Build CRUD API routes
4. Create ResumeGallery component
5. Create Upload dialog
6. Integrate into dashboard
7. Full end-to-end testing

---

## Design Inspiration & Notes

### Visual Reference
Think **Instagram profile grid** meets **Google Drive**:
- Clean, minimal card design
- Hover reveals actions (like IG post hover on desktop)
- Upload button prominent like "New Post"
- Responsive grid that adapts to screen size

### UX Considerations
- **Security**: Row Level Security ensures users only see their own resumes
- **Performance**: 
  - Lazy load thumbnails for large collections
  - Cache signed URLs (1 hour expiry)
  - Optimistic UI updates on delete/upload
- **Accessibility**: 
  - Keyboard navigation for all actions
  - ARIA labels on icon buttons
  - Screen reader announcements for uploads/deletes
- **Error Handling**: 
  - Graceful failures with user-friendly messages
  - Retry logic for network issues
  - Rollback on failed uploads

### Future Enhancements
- PDF thumbnail generation (first page preview)
- Resume version tracking
- Tags/categories (e.g., "Software Engineer", "Product Manager")
- AI-powered resume analysis/scoring
- Share links for specific resumes
- Bulk operations (delete multiple)
