-- Final debugging - check if there's a database constraint or trigger issue
-- Run this in Supabase SQL Editor

-- Test 1: Check if there are any active triggers
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles';

-- Test 2: Check for any constraints that might be failing
SELECT
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  CASE con.contype
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 't' THEN 'TRIGGER'
    WHEN 'x' THEN 'EXCLUSION'
  END AS constraint_type_desc
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'profiles';

-- Test 3: Try a simple SELECT to see if the table itself works
SELECT COUNT(*) FROM profiles;

-- Test 4: Try the exact query with explicit casting
SELECT role::text FROM profiles WHERE id::uuid = '175c1e40-d634-4477-9e8b-b91749eb1879'::uuid;

-- Test 5: Check if RLS is blocking the query
SELECT * FROM profiles WHERE id = '175c1e40-d634-4477-9e8b-b91749eb1879';

-- Test 6: Temporarily disable RLS to see if that's the issue
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Try the query again
SELECT role FROM profiles WHERE id = '175c1e40-d634-4477-9e8b-b91749eb1879';

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
