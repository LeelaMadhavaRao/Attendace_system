-- Check all foreign key relationships between hods and profiles tables

-- Step 1: List all foreign keys involving hods table
SELECT
  rc.constraint_name,
  kcu.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.referential_constraints rc
JOIN information_schema.key_column_usage kcu
  ON rc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE kcu.table_name = 'hods' OR ccu.table_name = 'hods';

-- Step 2: Check hods table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'hods'
ORDER BY ordinal_position;

-- Step 3: Check all constraints on hods table
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'hods';

-- Step 4: List specific foreign keys on hods table
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='hods';
