-- Add name and display_name columns to faculty table for role-specific names
-- Run this in Supabase SQL Editor

-- Step 1: Add columns to faculty table if they don't exist
ALTER TABLE faculty 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Step 2: Update existing faculty records with their profile names
UPDATE faculty f
SET name = p.name,
    display_name = p.name
FROM profiles p
WHERE f.profile_id = p.id AND f.name IS NULL;

-- Step 3: Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'faculty'
ORDER BY ordinal_position;
