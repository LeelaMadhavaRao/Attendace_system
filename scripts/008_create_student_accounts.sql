-- Migration Script: Create Auth Accounts for Existing Students
-- This script helps identify students who need auth accounts created
-- Run this BEFORE using the bulk account creation tool

-- 1. Check how many students exist without auth accounts
SELECT 
    'Total Students' as metric,
    COUNT(*) as count
FROM students
UNION ALL
SELECT 
    'Students with Profiles',
    COUNT(DISTINCT p.id)
FROM students s
LEFT JOIN profiles p ON p.role = 'student' 
    AND p.email LIKE '%@student.local'
    AND p.name = s.name;

-- 2. List all students grouped by class for account creation
-- This output can be used to create accounts manually or via API
SELECT 
    c.name as class_name,
    c.id as class_id,
    s.register_number,
    s.name as student_name,
    s.id as student_id,
    CONCAT(s.register_number, '-', c.name) as suggested_username,
    s.register_number as suggested_password
FROM students s
JOIN classes c ON s.class_id = c.id
ORDER BY c.name, s.register_number;

-- 3. Check for duplicate register numbers (potential issues)
SELECT 
    register_number,
    COUNT(*) as count,
    STRING_AGG(name, ', ') as student_names
FROM students
GROUP BY register_number
HAVING COUNT(*) > 1;

-- 4. Students with special characters in register numbers (may need sanitization)
SELECT 
    s.register_number,
    s.name,
    c.name as class_name,
    CONCAT(s.register_number, '-', c.name) as username,
    LOWER(REGEXP_REPLACE(CONCAT(s.register_number, '-', c.name), '[^a-z0-9-]', '', 'g')) as sanitized_email_prefix
FROM students s
JOIN classes c ON s.class_id = c.id
WHERE s.register_number ~ '[^a-zA-Z0-9-]'
ORDER BY s.register_number;

-- 5. Summary by class
SELECT 
    c.name as class_name,
    c.id as class_id,
    COUNT(s.id) as total_students,
    STRING_AGG(s.register_number, ', ' ORDER BY s.register_number) as register_numbers
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;
