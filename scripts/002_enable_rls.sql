-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hods ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_messages ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "HOD can view faculty in department" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN hods h ON h.profile_id = p.id
      WHERE p.id = auth.uid() AND profiles.department = h.department
    )
  );

CREATE POLICY "Admin can insert profiles" ON profiles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- HODs RLS Policies
CREATE POLICY "Admin can manage HODs" ON hods
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "HOD can view own record" ON hods
  FOR SELECT USING (profile_id = auth.uid());

-- Faculty RLS Policies
CREATE POLICY "Admin can manage all faculty" ON faculty
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "HOD can manage faculty in department" ON faculty
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hods WHERE profile_id = auth.uid() AND hods.id = faculty.hod_id
    )
  );

CREATE POLICY "Faculty can view own record" ON faculty
  FOR SELECT USING (profile_id = auth.uid());

-- Classes RLS Policies
CREATE POLICY "Faculty can manage own classes" ON classes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM faculty WHERE profile_id = auth.uid() AND id = classes.faculty_id)
  );

CREATE POLICY "HOD can view classes by their faculty" ON classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hods h
      JOIN faculty f ON f.hod_id = h.id
      WHERE h.profile_id = auth.uid() AND f.id = classes.faculty_id
    )
  );

CREATE POLICY "Admin can view all classes" ON classes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Students RLS Policies
CREATE POLICY "Faculty can manage students in own classes" ON students
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM classes c
      JOIN faculty f ON f.id = c.faculty_id
      WHERE f.profile_id = auth.uid() AND c.id = students.class_id
    )
  );

CREATE POLICY "HOD can view students in their faculty classes" ON students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hods h
      JOIN faculty f ON f.hod_id = h.id
      JOIN classes c ON c.faculty_id = f.id
      WHERE h.profile_id = auth.uid() AND c.id = students.class_id
    )
  );

CREATE POLICY "Admin can view all students" ON students
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Subjects RLS Policies
CREATE POLICY "Faculty can manage own subjects" ON subjects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM faculty WHERE profile_id = auth.uid() AND id = subjects.faculty_id)
  );

CREATE POLICY "View subjects for accessible classes" ON subjects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes c
      JOIN faculty f ON f.id = c.faculty_id
      WHERE c.id = subjects.class_id AND (
        f.profile_id = auth.uid() OR
        EXISTS (SELECT 1 FROM hods h WHERE h.profile_id = auth.uid() AND h.id = f.hod_id) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

-- Attendance Sessions RLS Policies
CREATE POLICY "Faculty can manage own sessions" ON attendance_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM faculty WHERE profile_id = auth.uid() AND id = attendance_sessions.faculty_id)
  );

CREATE POLICY "HOD can view sessions from their faculty" ON attendance_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hods h
      JOIN faculty f ON f.hod_id = h.id
      WHERE h.profile_id = auth.uid() AND f.id = attendance_sessions.faculty_id
    )
  );

CREATE POLICY "Admin can view all sessions" ON attendance_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Attendance Records RLS Policies
CREATE POLICY "Faculty can manage attendance in own sessions" ON attendance_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM attendance_sessions asess
      JOIN faculty f ON f.id = asess.faculty_id
      WHERE f.profile_id = auth.uid() AND asess.id = attendance_records.session_id
    )
  );

CREATE POLICY "HOD can view attendance from their faculty" ON attendance_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM attendance_sessions asess
      JOIN faculty f ON f.id = asess.faculty_id
      JOIN hods h ON h.id = f.hod_id
      WHERE h.profile_id = auth.uid() AND asess.id = attendance_records.session_id
    )
  );

CREATE POLICY "Admin can view all attendance" ON attendance_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Chat History RLS Policies
CREATE POLICY "Faculty can view own chat history" ON chat_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM faculty WHERE profile_id = auth.uid() AND id = chat_history.faculty_id)
  );

-- Parent Messages RLS Policies
CREATE POLICY "Faculty can view messages for students in own classes" ON parent_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      JOIN faculty f ON f.id = c.faculty_id
      WHERE f.profile_id = auth.uid() AND s.id = parent_messages.student_id
    )
  );
