-- Alternative: Temporarily disable trigger to create admin user
-- Run this in Supabase SQL Editor

-- Step 1: Disable the trigger
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Now go to Authentication > Users and create the admin user:
-- Email: admin@attendance.com
-- Password: Admin@123456

-- Step 2: After user is created, manually create the profile
-- Replace <USER_ID> with the UUID of the created user
INSERT INTO profiles (id, email, name, role)
VALUES (
  '<USER_ID>',  -- Replace with actual user ID from auth.users
  'admin@attendance.com',
  'System Administrator',
  'admin'
);

-- Step 3: Re-enable the trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- Verify admin user exists
SELECT 
  u.id,
  u.email,
  u.created_at,
  p.name,
  p.role
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'admin@attendance.com';
