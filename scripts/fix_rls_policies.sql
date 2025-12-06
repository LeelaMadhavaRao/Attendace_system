-- Fix RLS policies for profiles table to allow user login
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================
-- Step 1: Drop ALL existing policies on profiles
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "HOD can view faculty in department" ON profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Service role has full access" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "authenticated_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "authenticated_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
DROP POLICY IF EXISTS "admin_insert_profiles" ON profiles;
DROP POLICY IF EXISTS "admin_update_all_profiles" ON profiles;
DROP POLICY IF EXISTS "admin_delete_profiles" ON profiles;
DROP POLICY IF EXISTS "service_role_full_access" ON profiles;

-- ============================================
-- Step 2: Create NEW simplified policies
-- ============================================

-- Policy 1: Allow authenticated users to read their own profile
-- This is CRITICAL for login to work
CREATE POLICY "authenticated_read_own_profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Allow authenticated users to update their own profile
CREATE POLICY "authenticated_update_own_profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: Allow admins to read all profiles
CREATE POLICY "admin_read_all_profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy 4: Allow admins to insert profiles
CREATE POLICY "admin_insert_profiles"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy 5: Allow admins to update any profile
CREATE POLICY "admin_update_all_profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy 6: Allow admins to delete profiles
CREATE POLICY "admin_delete_profiles"
ON profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy 7: Service role full access (for server-side operations)
CREATE POLICY "service_role_full_access"
ON profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- Step 3: Ensure RLS is enabled
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 4: Verify the policies
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN cmd = 'r' THEN 'SELECT'
    WHEN cmd = 'a' THEN 'INSERT'
    WHEN cmd = 'w' THEN 'UPDATE'
    WHEN cmd = 'd' THEN 'DELETE'
    WHEN cmd = '*' THEN 'ALL'
  END as command,
  CASE 
    WHEN roles = '{authenticated}' THEN 'authenticated'
    WHEN roles = '{service_role}' THEN 'service_role'
    ELSE roles::text
  END as for_role
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- Step 5: Grant necessary permissions
-- ============================================
GRANT SELECT ON profiles TO authenticated;
GRANT INSERT, UPDATE ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'RLS policies fixed successfully! Users can now login.';
END $$;
