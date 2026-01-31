# Spratt Setup Guide

## Prerequisites

- Node.js 18+ installed
- Supabase account and project
- Azure DevOps account (for MCP integration)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Edit `.env` file with your credentials:

```bash
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key"
VITE_SUPABASE_URL="your_supabase_url"
AZURE_DEVOPS_PAT="your_azure_devops_pat"
```

**Get Supabase credentials:**
- Go to your Supabase project dashboard
- Settings → API
- Copy "Project URL" → `VITE_SUPABASE_URL`
- Copy "anon public" key → `VITE_SUPABASE_ANON_KEY`

**Get Azure DevOps PAT:**
- Go to Azure DevOps → User Settings (top right) → Personal Access Tokens
- Create new token with scopes: Work Items (Read & Write), Code (Read & Write)

### 3. Set Up Supabase Database

**Option A: Using Supabase CLI (Recommended)**

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

**Option B: Manual SQL Execution**

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and execute

### 4. Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "Create Bucket"
3. Name: `recordings`
4. Public bucket: **Yes** (or configure RLS policies)
5. File size limit: 100MB
6. Allowed MIME types: `audio/webm`, `audio/mpeg`, `audio/wav`

**Storage RLS Policy (if bucket is private):**

```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to read their own recordings
CREATE POLICY "Users can read own recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can read all recordings
CREATE POLICY "Admins can read all recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'recordings' AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
```

### 5. Set Up First Admin User

After creating your account, update your role to admin:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

### 6. Run the Application

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 7. Test the Flow

1. **Sign Up/Login**: Create an account or sign in
2. **Record Audio**: Click "Start Recording" and speak some action items
   - Example: "Call Steve Smith tomorrow about the project"
   - Example: "Send the proposal to client@example.com"
3. **Stop Recording**: Click "Stop Recording" - it will process automatically
4. **Review Actions**: Actions will appear in the Actions section
5. **Approve/Reject**: Review and approve or reject actions
6. **Azure DevOps Sync**: Approved actions will sync to Azure DevOps (if configured)

## Troubleshooting

### Microphone Permission Denied

- Check browser permissions for microphone access
- Ensure you're using HTTPS (or localhost)

### Supabase Connection Errors

- Verify `.env` variables are correct
- Check Supabase project is active
- Verify RLS policies are set up correctly

### Storage Upload Fails

- Verify storage bucket exists and is named `recordings`
- Check bucket permissions (public or RLS policies)
- Verify file size limits

### Actions Not Appearing

- Check browser console for errors
- Verify transcription service is working
- Check Supabase logs for database errors

### Azure DevOps Integration Not Working

- Verify `AZURE_DEVOPS_PAT` is set in `.env`
- Check MCP servers are running (if using local MCP)
- Verify PAT has correct permissions

## Next Steps

- [ ] Set up real transcription API (OpenAI Whisper)
- [ ] Configure AI action extraction (OpenAI GPT-4)
- [ ] Set up MCP server endpoints
- [ ] Configure Azure DevOps project/organization
- [ ] Add error handling and retry logic
- [ ] Add action editing capabilities
