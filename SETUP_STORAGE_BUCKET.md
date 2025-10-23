# Setup Storage Bucket for Resume Gallery

## Quick Fix: Create the `resumes` Storage Bucket

The resume gallery needs a storage bucket to store resume files. Here's how to create it:

### Option 1: Via Supabase Dashboard (Recommended - 30 seconds)

1. Go to your Supabase project: https://supabase.com/dashboard/project/iorioskzgchxegxuyiiy
2. Click **Storage** in the left sidebar
3. Click **New bucket** button
4. Fill in the form:
   - **Name**: `resumes`
   - **Public bucket**: ❌ **UNCHECK THIS** (keep it private)
   - **File size limit**: 10 MB (optional)
   - **Allowed MIME types**: `application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain` (optional)
5. Click **Create bucket**

### Option 2: Via SQL (Alternative)

Run this in your Supabase SQL Editor:

```sql
-- Create the resumes storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false);

-- Set up storage policies for the bucket
CREATE POLICY "Users can upload own resumes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resumes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own resumes"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own resumes"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

## Verify It Works

After creating the bucket:

1. Refresh your browser at http://localhost:3002/dashboard
2. Try uploading a resume
3. You should see it appear in the gallery!

## Storage Structure

Files will be stored as:
```
resumes/
  {userId}/
    {timestamp}_{filename}.pdf
    {timestamp}_{filename}.docx
```

Example:
```
resumes/
  e45ddcb9-5dc0-4c92-b450-c330280aec5b/
    1729123456789_Software_Engineer_Resume.pdf
    1729234567890_Data_Analyst_Resume.docx
```

## Security

- Bucket is **private** (not publicly accessible)
- Row Level Security (RLS) policies ensure users can only:
  - Upload files to their own folder (`resumes/{their-user-id}/`)
  - View/download their own files
  - Delete their own files
- Download URLs are **signed** and expire after 1 hour

## Troubleshooting

### "Bucket not found" error
- Make sure you created the bucket with the exact name `resumes` (lowercase)
- Verify it's set to **Private** (not public)

### "Permission denied" errors
- Make sure the storage policies (Option 2 SQL) are applied
- The policies ensure users can only access their own files

### Files not appearing after upload
- Check the Supabase Storage dashboard to see if files are actually uploading
- Check browser console for any errors
- Verify the file path format: `resumes/{userId}/{timestamp}_{filename}`
