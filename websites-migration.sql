-- Create websites table for the Web Architect skill
CREATE TABLE IF NOT EXISTS websites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  html_content TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index for the slug (user_id + timestamp)
CREATE UNIQUE INDEX IF NOT EXISTS idx_websites_user_timestamp ON websites(user_id, timestamp);

-- Disable RLS for compatibility with Firebase Auth
ALTER TABLE websites DISABLE ROW LEVEL SECURITY;
