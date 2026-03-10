-- ============================================================
--  Student Grades API — Database Schema
--  Database: SQLite (default) / PostgreSQL compatible
-- ============================================================

-- ─── USERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'student'
                          CHECK(role IN ('admin', 'student')),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── STUDENTS ─────────────────────────────────────────────
-- Each student is also a user; this extends with academic info
CREATE TABLE IF NOT EXISTS students (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL UNIQUE,
    student_number TEXT   NOT NULL UNIQUE,   -- e.g. STU-2026-001
    year_of_study INTEGER DEFAULT 1
                          CHECK(year_of_study BETWEEN 1 AND 6),
    program       TEXT    NOT NULL,          -- e.g. "Computer Science"
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── COURSES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    code          TEXT    NOT NULL UNIQUE,   -- e.g. "CS101"
    name          TEXT    NOT NULL,          -- e.g. "Intro to Programming"
    credits       INTEGER NOT NULL DEFAULT 3
                          CHECK(credits BETWEEN 1 AND 10),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── GRADES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grades (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id    INTEGER NOT NULL,
    course_id     INTEGER NOT NULL,
    score         REAL    NOT NULL
                          CHECK(score BETWEEN 0 AND 100),
    grade_letter  TEXT    NOT NULL,          -- e.g. "A", "B+", "C-"
    semester      TEXT    NOT NULL,          -- e.g. "Spring 2026"
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE,

    -- One grade per student per course per semester
    UNIQUE(student_id, course_id, semester)
);

-- ─── INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_grades_student   ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_course    ON grades(course_id);
CREATE INDEX IF NOT EXISTS idx_grades_semester  ON grades(semester);
CREATE INDEX IF NOT EXISTS idx_students_user    ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);

-- ─── SEED DATA ────────────────────────────────────────────
-- Password hashes below are bcrypt of "pass123" / "admin123"
-- (replace with real hashes in production)

INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES
  (1, 'Admin User',  'admin@school.edu', 'hashed_admin123', 'admin'),
  (2, 'Jane Smith',  'jane@school.edu',  'hashed_pass123',  'student'),
  (3, 'John Doe',    'john@school.edu',  'hashed_pass123',  'student');

INSERT OR IGNORE INTO students (user_id, student_number, year_of_study, program) VALUES
  (2, 'STU-2026-001', 2, 'Computer Science'),
  (3, 'STU-2026-002', 1, 'Mathematics');

INSERT OR IGNORE INTO courses (id, code, name, credits) VALUES
  (1, 'CS101',  'Intro to Programming',  3),
  (2, 'MATH201','Calculus II',            4),
  (3, 'PHY101', 'Physics I',              3),
  (4, 'HIST101','World History',          2);

INSERT OR IGNORE INTO grades (student_id, course_id, score, grade_letter, semester) VALUES
  (1, 1, 92.0, 'A',  'Spring 2026'),
  (1, 2, 87.5, 'B+', 'Spring 2026'),
  (1, 3, 90.0, 'A-', 'Spring 2026'),
  (2, 1, 78.0, 'C+', 'Spring 2026'),
  (2, 4, 95.0, 'A',  'Spring 2026');
