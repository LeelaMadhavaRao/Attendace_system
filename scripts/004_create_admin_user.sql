-- This script creates the initial admin profile
-- Note: You need to first create a user via Supabase Auth, then run this

-- Create a function to set up admin profile after auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'faculty')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Service role policy for profile creation (allows backend to create profiles)
DROP POLICY IF EXISTS "Service role can manage all profiles" ON profiles;
CREATE POLICY "Service role can manage all profiles" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all HODs" ON hods;
CREATE POLICY "Service role can manage all HODs" ON hods
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all faculty" ON faculty;
CREATE POLICY "Service role can manage all faculty" ON faculty
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all classes" ON classes;
CREATE POLICY "Service role can manage all classes" ON classes
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all students" ON students;
CREATE POLICY "Service role can manage all students" ON students
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all subjects" ON subjects;
CREATE POLICY "Service role can manage all subjects" ON subjects
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all sessions" ON attendance_sessions;
CREATE POLICY "Service role can manage all sessions" ON attendance_sessions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all records" ON attendance_records;
CREATE POLICY "Service role can manage all records" ON attendance_records
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all chat" ON chat_history;
CREATE POLICY "Service role can manage all chat" ON chat_history
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all parent messages" ON parent_messages;
CREATE POLICY "Service role can manage all parent messages" ON parent_messages
  FOR ALL USING (auth.role() = 'service_role');
