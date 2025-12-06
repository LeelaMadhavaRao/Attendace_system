-- Function to calculate attendance percentage for a student in a class
CREATE OR REPLACE FUNCTION get_student_attendance_percentage(
  p_student_id UUID,
  p_class_id UUID DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  total_sessions INTEGER;
  attended_sessions INTEGER;
BEGIN
  IF p_class_id IS NULL THEN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE ar.is_present = true)
    INTO total_sessions, attended_sessions
    FROM attendance_sessions asess
    JOIN attendance_records ar ON ar.session_id = asess.id
    WHERE ar.student_id = p_student_id;
  ELSE
    SELECT COUNT(*), COUNT(*) FILTER (WHERE ar.is_present = true)
    INTO total_sessions, attended_sessions
    FROM attendance_sessions asess
    JOIN attendance_records ar ON ar.session_id = asess.id
    WHERE ar.student_id = p_student_id AND asess.class_id = p_class_id;
  END IF;

  IF total_sessions = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((attended_sessions::NUMERIC / total_sessions::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get attendance percentage for a subject
CREATE OR REPLACE FUNCTION get_student_subject_attendance(
  p_student_id UUID,
  p_subject_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  total_sessions INTEGER;
  attended_sessions INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE ar.is_present = true)
  INTO total_sessions, attended_sessions
  FROM attendance_sessions asess
  JOIN attendance_records ar ON ar.session_id = asess.id
  WHERE ar.student_id = p_student_id AND asess.subject_id = p_subject_id;

  IF total_sessions = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((attended_sessions::NUMERIC / total_sessions::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get students below a certain attendance percentage
CREATE OR REPLACE FUNCTION get_students_below_percentage(
  p_class_id UUID,
  p_percentage NUMERIC DEFAULT 75
)
RETURNS TABLE (
  student_id UUID,
  register_number TEXT,
  student_name TEXT,
  parent_whatsapp TEXT,
  attendance_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.register_number,
    s.name,
    s.parent_whatsapp_number,
    get_student_attendance_percentage(s.id, p_class_id) as percentage
  FROM students s
  WHERE s.class_id = p_class_id
  AND get_student_attendance_percentage(s.id, p_class_id) < p_percentage
  ORDER BY percentage ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get class overall attendance
CREATE OR REPLACE FUNCTION get_class_attendance_summary(p_class_id UUID)
RETURNS TABLE (
  total_students INTEGER,
  total_sessions INTEGER,
  avg_attendance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM students WHERE class_id = p_class_id),
    (SELECT COUNT(*)::INTEGER FROM attendance_sessions WHERE class_id = p_class_id),
    (
      SELECT COALESCE(ROUND(AVG(
        CASE WHEN (SELECT COUNT(*) FROM attendance_sessions WHERE class_id = p_class_id) > 0 
        THEN get_student_attendance_percentage(s.id, p_class_id)
        ELSE 0 END
      ), 2), 0)
      FROM students s WHERE s.class_id = p_class_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hods_updated_at
  BEFORE UPDATE ON hods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_faculty_updated_at
  BEFORE UPDATE ON faculty
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
