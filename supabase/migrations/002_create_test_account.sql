-- Create test account profile
-- NOTE: You must create the user in Supabase Dashboard first:
-- 1. Go to Authentication → Users → Add User
-- 2. Email: test@spratt.com, Password: test123456
-- 3. Auto-confirm email: Yes
-- 4. Then run this SQL

-- Update profile for test user (creates if doesn't exist)
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
