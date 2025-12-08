-- Add name and display_name columns to hods table for role-specific names
-- Run this in Supabase SQL Editor

-- Step 1: Add columns to hods table if they don't exist
ALTER TABLE hods 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Step 2: Update existing HOD records with their profile names
UPDATE hods h
SET name = p.name,
    display_name = p.name
FROM profiles p
WHERE h.profile_id = p.id AND h.name IS NULL;

-- Step 3: Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'hods'
ORDER BY ordinal_position;

-- Now you can update a HOD's display_name independently:
-- UPDATE hods SET name = 'HOD Name' WHERE profile_id = 'user-id';
