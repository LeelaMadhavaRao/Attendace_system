-- Check faculty table structure and all its columns
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'faculty'
ORDER BY ordinal_position;
