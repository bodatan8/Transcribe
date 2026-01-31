#!/usr/bin/env node

/**
 * Fix RLS recursion issue in Supabase using direct REST API
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

// Extract project ref from URL
const projectRef = supabaseUrl.replace('https://', '').split('.')[0]
console.log(`Project: ${projectRef}`)

async function fixRLS() {
  console.log('🔧 Fixing RLS recursion issue...\n')

  // Combined SQL to run all at once
  const fixSql = `
-- Drop problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all recordings" ON recordings;
DROP POLICY IF EXISTS "Admins can view all actions" ON actions;

-- Create security definer function
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

-- Recreate policies using the function
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can view all recordings"
ON recordings FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can view all actions"
ON actions FOR SELECT
TO authenticated
USING (public.is_admin());

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
`

  console.log('The Supabase REST API cannot execute DDL directly.')
  console.log('Please run this SQL in Supabase Dashboard → SQL Editor:\n')
  console.log('=' .repeat(60))
  console.log(fixSql)
  console.log('=' .repeat(60))
  console.log('\nSteps:')
  console.log('1. Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql')
  console.log('2. Paste the SQL above')
  console.log('3. Click "Run"')
  console.log('4. Refresh the app')
}

fixRLS().catch(console.error)
