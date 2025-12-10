-- Add missing RLS policy for HOD to view classes by department
-- This allows HOD to see classes when faculty linking might be incomplete

-- First, check if policy already exists (Supabase doesn't support DROP POLICY IF EXISTS in all versions)
-- So we'll add the new policy

CREATE POLICY "HOD can view classes by department" ON classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hods h
      WHERE h.profile_id = auth.uid() AND classes.department = h.department
    )
  );

-- Explanation:
-- This policy allows an authenticated user who is an HOD to view any classes
-- whose department matches the HOD's department.
-- This is a fallback when the direct faculty->hod_id relationship might not be established.
