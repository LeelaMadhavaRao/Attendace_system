-- Fix faculty records with NULL hod_id 
-- This script handles three scenarios for matching faculty to HODs:
-- 1. If created by a HOD, use that HOD's record
-- 2. Otherwise, match by department
-- 3. For edge cases, requires manual assignment

-- STEP 1: Show current state - count of faculty with NULL hod_id
SELECT 'BEFORE FIX' as step;
SELECT COUNT(*) as faculty_with_null_hod FROM faculty WHERE hod_id IS NULL;

-- STEP 2: Fix faculty created directly by HODs
-- When a HOD creates faculty, their created_by profile should correspond to a HOD record
UPDATE faculty f
SET hod_id = h.id
FROM hods h
WHERE f.created_by = h.profile_id
AND f.hod_id IS NULL;

SELECT 'AFTER HOD CREATOR FIX' as step;
SELECT COUNT(*) as still_null FROM faculty WHERE hod_id IS NULL;

-- STEP 3: Fix remaining faculty by matching department
-- Faculty without assigned hod_id are matched to HOD in same department
UPDATE faculty f
SET hod_id = h.id
FROM hods h
WHERE f.department = h.department
AND f.hod_id IS NULL
AND h.id = (
  -- Get the first HOD in this department (in case multiple exist)
  SELECT id FROM hods WHERE department = f.department LIMIT 1
);

SELECT 'AFTER DEPARTMENT MATCH FIX' as step;
SELECT COUNT(*) as still_null FROM faculty WHERE hod_id IS NULL;

-- STEP 4: Show any remaining unassigned faculty (might need manual fix)
SELECT 'UNASSIGNED FACULTY (if any)' as section;
SELECT 
  f.id,
  f.profile_id,
  p.email,
  f.name,
  f.department,
  f.created_by,
  cp.email as created_by_email
FROM faculty f
LEFT JOIN profiles p ON f.profile_id = p.id
LEFT JOIN profiles cp ON f.created_by = cp.id
WHERE f.hod_id IS NULL
ORDER BY f.created_at DESC;

-- STEP 5: Verify the fixes
SELECT 'FINAL VERIFICATION' as step;
SELECT 
  f.id,
  f.profile_id,
  p.email as faculty_email,
  f.name as faculty_name,
  f.department,
  f.hod_id,
  h.profile_id as hod_profile_id,
  hp.email as hod_email
FROM faculty f
LEFT JOIN profiles p ON f.profile_id = p.id
LEFT JOIN hods h ON f.hod_id = h.id
LEFT JOIN profiles hp ON h.profile_id = hp.id
ORDER BY f.created_at DESC;

