-- Add faculty_id to students table to differentiate students by faculty
-- This allows multiple faculties to have same class names with different student lists

-- Add faculty_id column to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES faculty(id) ON DELETE CASCADE;

-- Populate faculty_id for existing students based on their class
UPDATE students 
SET faculty_id = classes.faculty_id
FROM classes
WHERE students.class_id = classes.id
AND students.faculty_id IS NULL;

-- Make faculty_id NOT NULL after populating existing data
ALTER TABLE students 
ALTER COLUMN faculty_id SET NOT NULL;

-- Drop old unique constraint
ALTER TABLE students 
DROP CONSTRAINT IF EXISTS students_register_number_class_id_key;

-- Add new unique constraint including faculty_id
-- This ensures same roll number can exist in different faculties but not within same faculty's class
ALTER TABLE students 
ADD CONSTRAINT students_register_number_class_id_faculty_id_key 
UNIQUE(register_number, class_id, faculty_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_students_faculty_id ON students(faculty_id);
CREATE INDEX IF NOT EXISTS idx_students_class_faculty ON students(class_id, faculty_id);

-- Update RLS policies for students table
DROP POLICY IF EXISTS "Faculty can view their students" ON students;
DROP POLICY IF EXISTS "Faculty can insert their students" ON students;
DROP POLICY IF EXISTS "Faculty can update their students" ON students;
DROP POLICY IF EXISTS "Faculty can delete their students" ON students;

-- Create new RLS policies with faculty_id check
CREATE POLICY "Faculty can view their students"
  ON students FOR SELECT
  TO authenticated
  USING (
    faculty_id IN (
      SELECT id FROM faculty WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Faculty can insert their students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (
    faculty_id IN (
      SELECT id FROM faculty WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Faculty can update their students"
  ON students FOR UPDATE
  TO authenticated
  USING (
    faculty_id IN (
      SELECT id FROM faculty WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Faculty can delete their students"
  ON students FOR DELETE
  TO authenticated
  USING (
    faculty_id IN (
      SELECT id FROM faculty WHERE profile_id = auth.uid()
    )
  );
