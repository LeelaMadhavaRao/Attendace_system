-- Check if hods and faculty tables have name columns
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('hods', 'faculty')
ORDER BY table_name, ordinal_position;
