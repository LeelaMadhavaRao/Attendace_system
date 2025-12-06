-- Check if profile exists for the user trying to login
-- Run this in Supabase SQL Editor

SELECT 
  u.id as user_id,
  u.email,
  u.created_at as user_created,
  p.id as profile_id,
  p.name,
  p.role,
  p.created_at as profile_created
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.id = '175c1e40-d634-4477-9e8b-b91749eb1879';

-- If the result shows NULL for profile columns, create the profile:
INSERT INTO profiles (id, email, name, role)
SELECT 
  id,
  email,
  'System Administrator',
  'admin'
FROM auth.users
WHERE id = '175c1e40-d634-4477-9e8b-b91749eb1879'
AND NOT EXISTS (
  SELECT 1 FROM profiles WHERE id = '175c1e40-d634-4477-9e8b-b91749eb1879'
);

-- Verify the profile was created
SELECT * FROM profiles WHERE id = '175c1e40-d634-4477-9e8b-b91749eb1879';
