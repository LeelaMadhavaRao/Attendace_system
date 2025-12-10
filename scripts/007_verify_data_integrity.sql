-- Verification and Diagnosis Script for Data Integrity
-- Run this to diagnose data relationship issues

-- 1. Check for HOD users with profiles but no HOD record
SELECT 'Missing HOD Records' as check_name,
       COUNT(*) as issue_count
FROM profiles p
WHERE p.role = 'hod'
  AND NOT EXISTS (SELECT 1 FROM hods h WHERE h.profile_id = p.id)
UNION ALL

-- 2. Check for faculty without HOD assignment
SELECT 'Faculty Without HOD Assignment',
       COUNT(*)
FROM faculty f
WHERE f.hod_id IS NULL
UNION ALL

-- 3. Check for faculty with invalid HOD references
SELECT 'Faculty With Invalid HOD References',
       COUNT(*)
FROM faculty f
WHERE f.hod_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM hods h WHERE h.id = f.hod_id)
UNION ALL

-- 4. Check for department mismatches (Faculty department != HOD department)
SELECT 'Department Mismatches Between Faculty and HOD',
       COUNT(*)
FROM faculty f
JOIN hods h ON f.hod_id = h.id
WHERE f.department != h.department
UNION ALL

-- 5. Check for classes without faculty
SELECT 'Classes Without Faculty Reference',
       COUNT(*)
FROM classes c
WHERE c.faculty_id IS NULL
UNION ALL

-- 6. Check for classes with invalid faculty references
SELECT 'Classes With Invalid Faculty References',
       COUNT(*)
FROM classes c
WHERE NOT EXISTS (SELECT 1 FROM faculty f WHERE f.id = c.faculty_id)
UNION ALL

-- 7. Check for classes with NULL department
SELECT 'Classes Missing Department',
       COUNT(*)
FROM classes c
WHERE c.department IS NULL
UNION ALL

-- 8. Check for classes where department doesn't match faculty department
SELECT 'Classes With Department Mismatch (vs Faculty)',
       COUNT(*)
FROM classes c
JOIN faculty f ON c.faculty_id = f.id
WHERE c.department != f.department;

-- DETAILED RESULTS (for debugging)
-- Faculty Without HOD Assignment
SELECT 'Faculty Without HOD Assignment' as detail_check, f.id, f.profile_id, f.department, f.hod_id, p.email, p.name
FROM faculty f
LEFT JOIN profiles p ON f.profile_id = p.id
WHERE f.hod_id IS NULL;

-- Department Mismatches
SELECT 'Department Mismatches' as detail_check, f.id as faculty_id, f.department as faculty_dept, h.id as hod_id, h.department as hod_dept, 
       fp.name as faculty_name, hp.name as hod_name
FROM faculty f
JOIN hods h ON f.hod_id = h.id
JOIN profiles fp ON f.profile_id = fp.id
JOIN profiles hp ON h.profile_id = hp.id
WHERE f.department != h.department;

-- Classes Missing Department
SELECT 'Classes Missing Department' as detail_check, c.id, c.name, c.faculty_id, f.department, p.name as faculty_name
FROM classes c
LEFT JOIN faculty f ON c.faculty_id = f.id
LEFT JOIN profiles p ON f.profile_id = p.id
WHERE c.department IS NULL;

-- Sample Data Check: HODs and Their Faculty
SELECT 'HOD Faculty Summary' as detail_check, h.id as hod_id, h.department, hp.name as hod_name, hp.email,
       COUNT(f.id) as faculty_count
FROM hods h
JOIN profiles hp ON h.profile_id = hp.id
LEFT JOIN faculty f ON f.hod_id = h.id
GROUP BY h.id, h.department, hp.name, hp.email
ORDER BY h.id;
