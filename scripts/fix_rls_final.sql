-- Fix RLS policies to avoid circular dependency
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================
-- Step 1: KEEP RLS DISABLED for now
-- ============================================
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 2: Drop ALL existing policies
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
DROP POLICY IF EXISTS "Service role can manage all profiles" ON profiles;

-- ============================================
-- Step 3: Create SIMPLE policies (no recursion)
-- ============================================

-- Policy 1: ALL authenticated users can read ALL profiles
-- This prevents circular dependency
CREATE POLICY "authenticated_can_read_all_profiles"
ON profiles
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Users can only update their own profile
CREATE POLICY "authenticated_update_own_profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: Service role full access (for server-side operations)
CREATE POLICY "service_role_full_access"
ON profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- Step 4: Re-enable RLS
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 5: Test the query
-- ============================================
SELECT role FROM profiles WHERE id = '175c1e40-d634-4477-9e8b-b91749eb1879';

-- ============================================
-- Step 6: Verify policies
-- ============================================
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
