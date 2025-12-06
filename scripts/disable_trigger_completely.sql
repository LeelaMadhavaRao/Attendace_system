-- Completely disable the problematic trigger and test
-- Run this in Supabase SQL Editor

-- Step 1: Drop the trigger that might be causing issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Drop the function
DROP FUNCTION IF EXISTS handle_new_user();

-- Step 3: Test the profile query directly (this should work now)
-- This simulates what the login form does
SELECT role 
FROM profiles 
WHERE id = '175c1e40-d634-4477-9e8b-b91749eb1879';

-- Step 4: Verify all policies are working
SELECT 
  policyname,
  CASE 
    WHEN cmd = 'r' THEN 'SELECT'
    WHEN cmd = 'w' THEN 'UPDATE'
    WHEN cmd = 'a' THEN 'INSERT'
    WHEN cmd = 'd' THEN 'DELETE'
    WHEN cmd = '*' THEN 'ALL'
  END as command
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
