-- Fix: Allow same email for different roles/users
-- Run this in Supabase SQL Editor

-- Step 1: Drop ALL existing constraints on profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS unique_profile_combination;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS unique_email;

-- Step 2: Create constraint ONLY on (name, phone) - email CAN be duplicated
-- This allows:
-- - Same email for different people (different roles)
-- - But prevents exact duplicates of name+phone combo
ALTER TABLE profiles 
ADD CONSTRAINT unique_name_phone 
UNIQUE NULLS NOT DISTINCT (name, phone);

-- Step 3: Verify the constraint
SELECT 
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'profiles'
AND con.contype = 'u';

-- Now you can create:
-- - Admin: leelamadhav.nulakani@gmail.com, name: Admin User, phone: 1234567890
-- - HOD: leelamadhav.nulakani@gmail.com, name: HOD User, phone: 1234567891
-- Same email, different names/phones ✓
