import { pool } from './db.js'

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'parent')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS student_snapshots (
    student_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS pair_codes (
    id UUID PRIMARY KEY,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(8) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS parent_student_links (
    parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (parent_user_id, student_user_id),
    CHECK (parent_user_id <> student_user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pair_codes_student ON pair_codes(student_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_student_links(parent_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_parent_links_student ON parent_student_links(student_user_id)`,
]

try {
  for (const statement of statements) await pool.query(statement)
  console.log('Database migrations completed successfully.')
} finally {
  await pool.end()
}
