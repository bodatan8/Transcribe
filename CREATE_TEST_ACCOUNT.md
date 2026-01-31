# Create Test Account in Backend

## Quick Method: Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Authentication → Users**
3. Click **"Add User"** or **"Invite User"**
4. Fill in:
   - **Email**: `test@spratt.com`
   - **Password**: `test123456`
   - **Auto-confirm email**: ✅ Check this box
5. Click **"Create User"**

## Then Run SQL Migration

After creating the user, run this SQL in Supabase SQL Editor:

```sql
-- Update profile for test user
UPDATE public.profiles 
SET 
  email = 'test@spratt.com',
  full_name = 'Test User',
  role = 'admin',
  updated_at = NOW()
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'test@spratt.com'
);

-- Ensure email is confirmed
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email = 'test@spratt.com';
```

## Or Use the Migration File

Run the migration file:
```bash
# If using Supabase CLI
supabase db push

# Or manually copy/paste supabase/migrations/002_create_test_account.sql
# into Supabase SQL Editor
```

## Test Account Credentials

- **Email**: `test@spratt.com`
- **Password**: `test123456`
- **Role**: `admin` (can see all records)

## After Creation

The test account will be ready to use. Just sign in with the credentials above.
