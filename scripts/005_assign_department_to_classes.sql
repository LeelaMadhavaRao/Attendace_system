-- Assign current department names to existing classes
-- This migration updates all classes with their faculty's department

BEGIN;

-- Update classes to have department from their faculty
UPDATE classes c
SET department = f.department
FROM faculty f
WHERE c.faculty_id = f.id AND c.department IS NULL;

-- Log the result
DO $$
DECLARE
  updated_count INT;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM classes WHERE department IS NOT NULL;
  RAISE NOTICE 'Updated % classes with department information', updated_count;
END $$;

COMMIT;
