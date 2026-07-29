import { config } from './config.js'
import { pool } from './db.js'

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student','parent')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS student_snapshots (
    student_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS parent_student_links (
    parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(parent_user_id,student_user_id),
    CHECK(parent_user_id <> student_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS student_records (
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL,
    record_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(student_user_id,record_type,record_id)
  )`,
  `CREATE TABLE IF NOT EXISTS app_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `DROP TABLE IF EXISTS pair_codes`,
  `CREATE INDEX IF NOT EXISTS idx_parent_links_parent
   ON parent_student_links(parent_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_parent_links_student
   ON parent_student_links(student_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_student_records_type
   ON student_records(student_user_id,record_type,updated_at DESC)`,
]

const formalLaunchResetKey = '2026-07-28-formal-launch-reset-v1'

if (config.useMemoryDb) {
  console.log('DB_MODE=memory: migrations are not required.')
} else if (pool) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const statement of schemaStatements) await client.query(statement)

    const applied = await client.query<{ migration_key: string }>(
      'SELECT migration_key FROM app_migrations WHERE migration_key=$1',
      [formalLaunchResetKey],
    )
    if (!applied.rowCount) {
      await client.query('DELETE FROM student_snapshots')
      await client.query(
        `DELETE FROM student_records
         WHERE record_type NOT IN ('material-imports','knowledge-items')`,
      )
      await client.query(
        'INSERT INTO app_migrations(migration_key) VALUES($1)',
        [formalLaunchResetKey],
      )
      console.log('Formal launch reset applied: learning history and profile snapshots cleared; accounts, family links and material records preserved.')
    }

    await client.query('COMMIT')
    console.log('Private-family database migrations completed successfully.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}
