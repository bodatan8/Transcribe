-- Complete script to create test account
-- Run this AFTER running 001_initial_schema.sql

-- Step 1: Create the user in auth.users (must be done via Supabase Dashboard first)
-- Go to: Authentication → Users → Add User
-- Email: test@spratt.com
-- Password: test123456
-- Auto-confirm email: Yes

-- Step 2: After user is created, run this SQL:

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

-- Verify it was created
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  u.email_confirmed_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.email = 'test@spratt.com';
