-- Test RLS policies are actually working
-- Run this in Supabase SQL Editor

-- Test 1: Direct query as service role (should work)
SELECT role FROM profiles WHERE id = '175c1e40-d634-4477-9e8b-b91749eb1879';

-- Test 2: Check if there are any database errors in logs
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%profiles%' 
ORDER BY calls DESC 
LIMIT 10;

-- Test 3: Verify the user can actually authenticate
SELECT 
  id,
  email,
  email_confirmed_at,
  encrypted_password IS NOT NULL as has_password
FROM auth.users 
WHERE id = '175c1e40-d634-4477-9e8b-b91749eb1879';

-- Test 4: Try to simulate the exact query from the app
-- This uses the anon key (what the browser uses)
SET ROLE anon;
SELECT role FROM profiles WHERE id = '175c1e40-d634-4477-9e8b-b91749eb1879';
RESET ROLE;

-- Test 5: Check table permissions
SELECT 
  grantee, 
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'profiles'
ORDER BY grantee, privilege_type;
