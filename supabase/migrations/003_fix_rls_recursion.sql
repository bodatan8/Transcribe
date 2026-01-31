-- Fix infinite recursion in RLS policies
-- The issue is that policies on profiles, recordings, and actions 
-- reference the profiles table to check admin role, causing a loop.

-- Step 1: Drop the problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all recordings" ON recordings;
DROP POLICY IF EXISTS "Admins can view all actions" ON actions;

-- Step 2: Create a security definer function to check admin role
-- This bypasses RLS when checking the role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 3: Recreate policies using the function
-- Note: The function runs with SECURITY DEFINER so it bypasses RLS

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can view all recordings
CREATE POLICY "Admins can view all recordings"
ON recordings FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can view all actions
CREATE POLICY "Admins can view all actions"
ON actions FOR SELECT
TO authenticated
USING (public.is_admin());

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
