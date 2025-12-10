-- Quick Diagnostic Queries for Data Issues

-- ===== STEP 1: Check all integrity issues =====
-- Run this to see which issues exist
SELECT 'Missing HOD Records' as check_name, COUNT(*) as issue_count
FROM profiles p
WHERE p.role = 'hod' AND NOT EXISTS (SELECT 1 FROM hods h WHERE h.profile_id = p.id)
UNION ALL
SELECT 'Faculty Without HOD Assignment', COUNT(*)
FROM faculty f WHERE f.hod_id IS NULL
UNION ALL
SELECT 'Faculty With Invalid HOD References', COUNT(*)
FROM faculty f WHERE f.hod_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hods h WHERE h.id = f.hod_id)
UNION ALL
SELECT 'Department Mismatches Between Faculty and HOD', COUNT(*)
FROM faculty f JOIN hods h ON f.hod_id = h.id WHERE f.department != h.department
UNION ALL
SELECT 'Classes Without Faculty Reference', COUNT(*)
FROM classes c WHERE c.faculty_id IS NULL
UNION ALL
SELECT 'Classes With Invalid Faculty References', COUNT(*)
FROM classes c WHERE NOT EXISTS (SELECT 1 FROM faculty f WHERE f.id = c.faculty_id)
UNION ALL
SELECT 'Classes Missing Department', COUNT(*)
FROM classes c WHERE c.department IS NULL
UNION ALL
SELECT 'Classes With Department Mismatch (vs Faculty)', COUNT(*)
FROM classes c JOIN faculty f ON c.faculty_id = f.id WHERE c.department != f.department;

-- ===== STEP 2: Get faculty details for the HOD =====
-- Shows which faculty belong to your HOD and how many classes each has
SELECT 
  f.id as faculty_id,
  p.email as faculty_email,
  p.name as faculty_name,
  f.department,
  f.hod_id,
  COUNT(c.id) as class_count
FROM faculty f
LEFT JOIN profiles p ON f.profile_id = p.id
LEFT JOIN classes c ON c.faculty_id = f.id
WHERE f.hod_id = '8c521e7d-8f7b-4f19-bd6d-df8aff70deac'
GROUP BY f.id, p.email, p.name, f.department, f.hod_id
ORDER BY f.id;

-- ===== STEP 3: Get all classes for those faculty =====
-- Shows all classes created by faculty under this HOD
SELECT 
  c.id,
  c.name,
  c.faculty_id,
  c.department,
  c.created_at,
  f.department as faculty_department,
  COUNT(s.id) as student_count
FROM classes c
LEFT JOIN faculty f ON c.faculty_id = f.id
LEFT JOIN students s ON s.class_id = c.id
WHERE c.faculty_id IN (
  SELECT f.id FROM faculty f 
  WHERE f.hod_id = '8c521e7d-8f7b-4f19-bd6d-df8aff70deac'
)
GROUP BY c.id, c.name, c.faculty_id, c.department, c.created_at, f.department
ORDER BY c.created_at DESC;

-- ===== STEP 4: Check department-based query =====
-- This is what the fallback query tries to do
SELECT 
  c.id,
  c.name,
  c.faculty_id,
  c.department,
  COUNT(s.id) as student_count
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
WHERE c.department = 'Computer Science & Engineering'
GROUP BY c.id, c.name, c.faculty_id, c.department
ORDER BY c.created_at DESC;

-- ===== STEP 5: Check raw classes table =====
-- Shows ALL classes - check if department column has data
SELECT 
  c.id,
  c.name,
  c.faculty_id,
  c.department,
  c.semester,
  c.academic_year,
  c.created_at
FROM classes c
ORDER BY c.created_at DESC
LIMIT 20;
