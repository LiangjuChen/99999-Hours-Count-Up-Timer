/*
# Create timer_subjects table for single-tenant timer app

1. New Tables
- `timer_subjects`
  - `id` (uuid, primary key) - Unique identifier for each subject
  - `name` (text, not null) - Display name of the subject
  - `seconds` (integer, default 0) - Accumulated time in seconds
  - `is_running` (boolean, default false) - Whether the timer is currently active
  - `created_at` (timestamptz, default now()) - When the subject was created

2. Security
- Enable RLS on `timer_subjects`.
- Allow anonymous and authenticated users full CRUD access since this is a single-tenant app with no authentication requirement.
*/

CREATE TABLE IF NOT EXISTS timer_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  seconds integer NOT NULL DEFAULT 0,
  is_running boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE timer_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_timer_subjects" ON timer_subjects;
CREATE POLICY "anon_select_timer_subjects" ON timer_subjects FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_timer_subjects" ON timer_subjects;
CREATE POLICY "anon_insert_timer_subjects" ON timer_subjects FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_timer_subjects" ON timer_subjects;
CREATE POLICY "anon_update_timer_subjects" ON timer_subjects FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_timer_subjects" ON timer_subjects;
CREATE POLICY "anon_delete_timer_subjects" ON timer_subjects FOR DELETE
  TO anon, authenticated USING (true);
