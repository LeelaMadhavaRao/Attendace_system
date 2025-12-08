-- Diagnostic script to check HOD and Faculty relationships
-- Run this to understand the current state of HOD/Faculty assignments

-- 1. Check all profiles and their roles
SELECT 'PROFILES' as section;
SELECT id, email, name, role, department FROM profiles ORDER BY email;

-- 2. Check all HOD records and their profile relationships
SELECT 'HODS' as section;
SELECT 
  h.id as hod_id,
  h.profile_id,
  p.email,
  p.name as profile_name,
  h.name as hod_name,
  h.department
FROM hods h
LEFT JOIN profiles p ON h.profile_id = p.id
ORDER BY h.created_at DESC;

-- 3. Check all Faculty records and their relationships
SELECT 'FACULTY' as section;
SELECT 
  f.id as faculty_id,
  f.profile_id,
  p.email,
  p.name as profile_name,
  f.name as faculty_name,
  f.hod_id,
  CASE 
    WHEN f.hod_id IS NULL THEN 'NULL - NOT ASSIGNED'
    ELSE 'ASSIGNED'
  END as hod_assignment_status,
  f.department
FROM faculty f
LEFT JOIN profiles p ON f.profile_id = p.id
ORDER BY f.created_at DESC;

-- 4. Check faculty with missing hod_id
SELECT 'FACULTY WITH NULL HOD_ID' as section;
SELECT COUNT(*) as count FROM faculty WHERE hod_id IS NULL;

-- 5. Try to match faculty to HODs by department (for fixing existing records)
SELECT 'FACULTY TO HOD MAPPING (by department)' as section;
SELECT 
  f.id as faculty_id,
  f.profile_id,
  fp.email as faculty_email,
  f.hod_id as current_hod_id,
  h.id as should_be_hod_id,
  h.profile_id as hod_profile_id,
  hp.email as hod_email
FROM faculty f
LEFT JOIN profiles fp ON f.profile_id = fp.id
LEFT JOIN hods h ON h.department = f.department
LEFT JOIN profiles hp ON h.profile_id = hp.id
WHERE f.hod_id IS NULL
ORDER BY f.created_at DESC;

-- 6. Check created_by relationships
SELECT 'FACULTY CREATED_BY CHECK' as section;
SELECT 
  f.id,
  f.profile_id,
  f.created_by,
  p1.email as faculty_email,
  p2.email as created_by_email,
  p2.role as creator_role
FROM faculty f
LEFT JOIN profiles p1 ON f.profile_id = p1.id
LEFT JOIN profiles p2 ON f.created_by = p2.id
ORDER BY f.created_at DESC;
