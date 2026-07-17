import pg from 'pg'
import { config } from './config.js'

const { Pool } = pg

export const pool = config.useMemoryDb ? null : new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
  if (!pool) throw new Error('SQL query requested while DB_MODE=memory')
  return pool.query<T>(text, params)
}
