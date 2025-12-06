-- Fix profiles table to allow same email for different roles
-- Only prevent duplicates when name + email + phone are ALL the same
-- Run this in Supabase SQL Editor

-- Step 1: Check current constraints
SELECT 
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'profiles';

-- Step 2: Drop the unique email constraint if it exists
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS unique_email;

-- Step 3: Create a new unique constraint on (name, email, phone) combination
-- This allows same email for different people, but prevents exact duplicates
ALTER TABLE profiles 
ADD CONSTRAINT unique_profile_combination 
UNIQUE NULLS NOT DISTINCT (name, email, phone);

-- Note: NULLS NOT DISTINCT means NULL values are considered equal
-- This prevents creating multiple entries with same name+email but NULL phone

-- Step 4: Verify the new constraint
SELECT 
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'profiles'
AND con.contype = 'u';  -- u = unique constraint

-- Step 5: Test - this should now work (same email, different name/phone)
-- You can create multiple profiles with same email as long as name or phone differs
