-- Fix the email with trailing space
-- Run this in Supabase SQL Editor

-- Check for emails with trailing spaces
SELECT id, email, LENGTH(email) as email_length, role
FROM profiles
WHERE email LIKE '% ';

-- Fix the email by trimming whitespace
UPDATE profiles
SET email = TRIM(email)
WHERE email LIKE '% ';

-- Also fix in auth.users
UPDATE auth.users
SET email = TRIM(email)
WHERE email LIKE '% ';

-- Verify the fix
SELECT id, email, LENGTH(email) as email_length, role
FROM profiles
WHERE id = '175c1e40-d634-4477-9e8b-b91749eb1879';

SELECT id, email, LENGTH(email) as email_length
FROM auth.users
WHERE id = '175c1e40-d634-4477-9e8b-b91749eb1879';
