-- SIMPLE 3-STEP DIAGNOSTIC
-- Run these queries one at a time and share results

-- ===== STEP 1: Do the 2 faculty have classes? =====
SELECT 
  f.id as faculty_id,
  p.name as faculty_name,
  COUNT(c.id) as number_of_classes
FROM faculty f
LEFT JOIN profiles p ON f.profile_id = p.id
LEFT JOIN classes c ON c.faculty_id = f.id
WHERE f.hod_id = '8c521e7d-8f7b-4f19-bd6d-df8aff70deac'
GROUP BY f.id, p.name;

-- ===== STEP 2: What does the primary query see? =====
-- This is exactly what the code does
SELECT 
  c.id,
  c.name,
  c.faculty_id,
  c.department,
  COUNT(s.id) as student_count
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
WHERE c.faculty_id IN (
  SELECT id FROM faculty WHERE hod_id = '8c521e7d-8f7b-4f19-bd6d-df8aff70deac'
)
GROUP BY c.id, c.name, c.faculty_id, c.department;

-- ===== STEP 3: Check if classes have NULL department =====
SELECT 
  COUNT(CASE WHEN c.department IS NULL THEN 1 END) as classes_with_null_department,
  COUNT(CASE WHEN c.department = 'Computer Science & Engineering' THEN 1 END) as classes_with_correct_department,
  COUNT(*) as total_classes
FROM classes c
WHERE c.faculty_id IN (
  SELECT id FROM faculty WHERE hod_id = '8c521e7d-8f7b-4f19-bd6d-df8aff70deac'
);
