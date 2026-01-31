# Complete Setup Instructions

## Step 1: Run Initial Database Migration

**IMPORTANT**: You must run the initial schema first!

1. Go to Supabase Dashboard → SQL Editor
2. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run it
4. Verify tables were created (check Table Editor)

## Step 2: Create Test User

1. Go to Supabase Dashboard → **Authentication → Users**
2. Click **"Add User"** or **"Invite User"**
3. Fill in:
   - **Email**: `test@spratt.com`
   - **Password**: `test123456`
   - **Auto-confirm email**: ✅ Check this box
4. Click **"Create User"**

## Step 3: Set Up Test User Profile

After creating the user, run this SQL in Supabase SQL Editor:

```sql
-- Create profile for test user
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  id,
  'test@spratt.com',
  'Test User',
  'admin'::user_role
FROM auth.users
WHERE email = 'test@spratt.com'
ON CONFLICT (id) 
DO UPDATE SET
  email = 'test@spratt.com',
  full_name = 'Test User',
  role = 'admin'::user_role,
  updated_at = NOW();

-- Ensure email is confirmed
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email = 'test@spratt.com';
```

## Step 4: Create Storage Bucket

1. Go to Supabase Dashboard → **Storage**
2. Click **"Create Bucket"**
3. Name: `recordings`
4. Public: **Yes**
5. Click **"Create"**

## Step 5: Test Login

1. Open the app
2. Sign in with:
   - Email: `test@spratt.com`
   - Password: `test123456`

## Troubleshooting

**If you get "relation profiles does not exist":**
- You haven't run `001_initial_schema.sql` yet
- Run that migration first, then try again

**If test user doesn't exist:**
- Create it via Supabase Dashboard first (Step 2)
- Then run the SQL (Step 3)
