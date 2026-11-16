-- Elective Course Allocation System (ECAS)
-- Relational Database Schema (SQLite)
-- Team T016 - SDE LAB, The LNMIIT Jaipur

PRAGMA foreign_keys = ON;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'faculty', 'admin', 'sysadmin')),
  department TEXT,
  designation TEXT,
  student_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Student Profiles
CREATE TABLE IF NOT EXISTS student_profiles (
  student_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  branch TEXT NOT NULL,
  batch TEXT NOT NULL,
  semester INTEGER NOT NULL,
  cgpa REAL NOT NULL CHECK (cgpa >= 0.0 AND cgpa <= 10.0),
  slot_id TEXT,
  email TEXT NOT NULL
);

-- 3. Registration Windows / Slots
CREATE TABLE IF NOT EXISTS registration_windows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  branches TEXT NOT NULL, -- JSON array of branches, e.g. ["CSE","CCE","ECE"]
  batch TEXT NOT NULL,
  semester INTEGER NOT NULL,
  start_date_time TEXT NOT NULL,
  end_date_time TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  min_preferences INTEGER NOT NULL DEFAULT 3,
  max_preferences INTEGER NOT NULL DEFAULT 5,
  description TEXT
);

-- 4. Elective Courses
CREATE TABLE IF NOT EXISTS electives (
  id TEXT PRIMARY KEY,
  course_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  department TEXT NOT NULL,
  applicable_branches TEXT NOT NULL, -- JSON array of branches
  applicable_semesters TEXT NOT NULL, -- JSON array of semesters
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  min_cgpa REAL NOT NULL DEFAULT 0.0 CHECK (min_cgpa >= 0.0 AND min_cgpa <= 10.0),
  prerequisites TEXT,
  faculty_name TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- 5. Student Preference Lists (UC-005)
CREATE TABLE IF NOT EXISTS preference_lists (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
  cycle_id TEXT NOT NULL REFERENCES registration_windows(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED')),
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, cycle_id)
);

-- 6. Preference Items (Ranked Selections)
CREATE TABLE IF NOT EXISTS preference_items (
  id TEXT PRIMARY KEY,
  preference_list_id TEXT NOT NULL REFERENCES preference_lists(id) ON DELETE CASCADE,
  elective_id TEXT NOT NULL REFERENCES electives(id) ON DELETE RESTRICT,
  rank INTEGER NOT NULL CHECK (rank >= 1),
  UNIQUE(preference_list_id, elective_id),
  UNIQUE(preference_list_id, rank)
);

-- 7. Allocation Configuration (UC-011)
CREATE TABLE IF NOT EXISTS allocation_rule_configs (
  cycle_id TEXT PRIMARY KEY REFERENCES registration_windows(id),
  cycle_name TEXT NOT NULL,
  tie_break_policy TEXT NOT NULL DEFAULT 'CGPA_MERIT' CHECK (tie_break_policy IN ('CGPA_MERIT', 'FIRST_COME_FIRST_SERVED', 'STUDENT_ID')),
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'COMPLETED')),
  description TEXT,
  max_allocations_per_student INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1))
);

-- 8. Allocation Results (UC-011, UC-015)
CREATE TABLE IF NOT EXISTS allocation_results (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  branch TEXT NOT NULL,
  semester INTEGER NOT NULL,
  cgpa REAL NOT NULL,
  elective_id TEXT REFERENCES electives(id) ON DELETE SET NULL,
  course_code TEXT,
  course_name TEXT,
  preference_rank INTEGER,
  status TEXT NOT NULL CHECK (status IN ('ALLOCATED', 'UNALLOCATED')),
  assigned_reason TEXT NOT NULL,
  allocated_at TEXT NOT NULL,
  UNIQUE(cycle_id, student_id)
);

-- 9. Audit Event Log
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. Sessions
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

-- Indexes for performance & query optimization
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id ON student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_preference_lists_student_cycle ON preference_lists(student_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_preference_items_list ON preference_items(preference_list_id);
CREATE INDEX IF NOT EXISTS idx_allocation_results_cycle ON allocation_results(cycle_id);
CREATE INDEX IF NOT EXISTS idx_allocation_results_student ON allocation_results(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp DESC);

