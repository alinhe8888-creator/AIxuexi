import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { pool, query } from './db.js'

export type Role = 'student' | 'parent'
export interface StoredUser { id: string; email: string; passwordHash: string; displayName: string; role: Role; createdAt: string }
export interface StoredRecord { id: string; type: string; payload: unknown; createdAt: string; updatedAt: string }

const memory = {
  users: new Map<string, StoredUser>(),
  usersByEmail: new Map<string, string>(),
  snapshots: new Map<string, { snapshot: unknown; updatedAt: string }>(),
  pairCodes: new Map<string, { id: string; studentId: string; expiresAt: string; usedAt: string | null }>(),
  links: new Map<string, Set<string>>(),
  records: new Map<string, Map<string, StoredRecord>>(),
}

const recordBucketKey = (studentId: string, type: string) => `${studentId}:${type}`

export const store = {
  async health() {
    if (config.useMemoryDb) return true
    await query('SELECT 1')
    return true
  },

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    if (config.useMemoryDb) {
      const id = memory.usersByEmail.get(email)
      return id ? memory.users.get(id) ?? null : null
    }
    const result = await query<{ id: string; email: string; password_hash: string; display_name: string; role: Role; created_at: string }>(
      'SELECT id,email,password_hash,display_name,role,created_at FROM users WHERE email=$1', [email],
    )
    const row = result.rows[0]
    return row ? { id: row.id, email: row.email, passwordHash: row.password_hash, displayName: row.display_name, role: row.role, createdAt: row.created_at } : null
  },

  async createUser(input: { email: string; passwordHash: string; displayName: string; role: Role }): Promise<StoredUser> {
    const user: StoredUser = { id: randomUUID(), email: input.email, passwordHash: input.passwordHash, displayName: input.displayName, role: input.role, createdAt: new Date().toISOString() }
    if (config.useMemoryDb) {
      if (memory.usersByEmail.has(user.email)) throw new Error('EMAIL_EXISTS')
      memory.users.set(user.id, user)
      memory.usersByEmail.set(user.email, user.id)
      return user
    }
    await query('INSERT INTO users(id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5)', [user.id, user.email, user.passwordHash, user.displayName, user.role])
    return user
  },

  async getSnapshot(studentId: string) {
    if (config.useMemoryDb) return memory.snapshots.get(studentId) ?? null
    const result = await query<{ snapshot: unknown; updated_at: string }>('SELECT snapshot,updated_at FROM student_snapshots WHERE student_user_id=$1', [studentId])
    const row = result.rows[0]
    return row ? { snapshot: row.snapshot, updatedAt: row.updated_at } : null
  },

  async saveSnapshot(studentId: string, snapshot: unknown) {
    const updatedAt = new Date().toISOString()
    if (config.useMemoryDb) {
      memory.snapshots.set(studentId, { snapshot, updatedAt })
      return { updatedAt }
    }
    await query(
      `INSERT INTO student_snapshots(student_user_id,snapshot,updated_at)
       VALUES($1,$2::jsonb,NOW())
       ON CONFLICT(student_user_id) DO UPDATE SET snapshot=EXCLUDED.snapshot,updated_at=NOW()`,
      [studentId, JSON.stringify(snapshot)],
    )
    return { updatedAt }
  },

  async issuePairCode(studentId: string, code: string, expiresAt: string) {
    if (config.useMemoryDb) {
      for (const [existingCode, item] of memory.pairCodes) if (item.studentId === studentId && !item.usedAt) memory.pairCodes.delete(existingCode)
      memory.pairCodes.set(code, { id: randomUUID(), studentId, expiresAt, usedAt: null })
      return
    }
    await query('DELETE FROM pair_codes WHERE student_user_id=$1 AND used_at IS NULL', [studentId])
    await query('INSERT INTO pair_codes(id,student_user_id,code,expires_at) VALUES($1,$2,$3,$4)', [randomUUID(), studentId, code, expiresAt])
  },

  async isPairCodeAvailable(code: string) {
    if (config.useMemoryDb) {
      const item = memory.pairCodes.get(code)
      return !item || Boolean(item.usedAt) || new Date(item.expiresAt).getTime() <= Date.now()
    }
    const result = await query('SELECT id FROM pair_codes WHERE code=$1 AND expires_at>NOW() AND used_at IS NULL', [code])
    return !result.rowCount
  },

  async consumePairCode(parentId: string, code: string): Promise<string | null> {
    if (config.useMemoryDb) {
      const item = memory.pairCodes.get(code)
      if (!item || item.usedAt || new Date(item.expiresAt).getTime() <= Date.now()) return null
      item.usedAt = new Date().toISOString()
      const children = memory.links.get(parentId) ?? new Set<string>()
      children.add(item.studentId)
      memory.links.set(parentId, children)
      return item.studentId
    }
    if (!pool) return null
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const codeResult = await client.query<{ id: string; student_user_id: string }>(
        `SELECT id,student_user_id FROM pair_codes WHERE code=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE`, [code],
      )
      const row = codeResult.rows[0]
      if (!row) { await client.query('ROLLBACK'); return null }
      await client.query(
        `INSERT INTO parent_student_links(parent_user_id,student_user_id) VALUES($1,$2)
         ON CONFLICT(parent_user_id,student_user_id) DO NOTHING`, [parentId, row.student_user_id],
      )
      await client.query('UPDATE pair_codes SET used_at=NOW() WHERE id=$1', [row.id])
      await client.query('COMMIT')
      return row.student_user_id
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },

  async listChildren(parentId: string) {
    if (config.useMemoryDb) {
      const ids = [...(memory.links.get(parentId) ?? new Set<string>())]
      return ids.flatMap((id) => {
        const user = memory.users.get(id)
        if (!user) return []
        return [{ id: user.id, email: user.email, displayName: user.displayName, linkedAt: user.createdAt, lastSyncedAt: memory.snapshots.get(id)?.updatedAt ?? null }]
      })
    }
    const result = await query<{ id: string; email: string; display_name: string; linked_at: string; snapshot_updated_at: string | null }>(
      `SELECT u.id,u.email,u.display_name,l.linked_at,s.updated_at AS snapshot_updated_at
       FROM parent_student_links l JOIN users u ON u.id=l.student_user_id
       LEFT JOIN student_snapshots s ON s.student_user_id=u.id
       WHERE l.parent_user_id=$1 ORDER BY l.linked_at DESC`, [parentId],
    )
    return result.rows.map((row) => ({ id: row.id, email: row.email, displayName: row.display_name, linkedAt: row.linked_at, lastSyncedAt: row.snapshot_updated_at }))
  },

  async getLinkedStudent(parentId: string, studentId: string) {
    if (config.useMemoryDb) {
      if (!memory.links.get(parentId)?.has(studentId)) return null
      const user = memory.users.get(studentId)
      if (!user) return null
      return { id: user.id, email: user.email, displayName: user.displayName, snapshot: memory.snapshots.get(studentId)?.snapshot ?? null }
    }
    const result = await query<{ id: string; email: string; display_name: string; snapshot: unknown }>(
      `SELECT u.id,u.email,u.display_name,s.snapshot
       FROM parent_student_links l JOIN users u ON u.id=l.student_user_id
       LEFT JOIN student_snapshots s ON s.student_user_id=u.id
       WHERE l.parent_user_id=$1 AND l.student_user_id=$2`, [parentId, studentId],
    )
    const row = result.rows[0]
    return row ? { id: row.id, email: row.email, displayName: row.display_name, snapshot: row.snapshot } : null
  },

  async unlinkChild(parentId: string, studentId: string) {
    if (config.useMemoryDb) { memory.links.get(parentId)?.delete(studentId); return }
    await query('DELETE FROM parent_student_links WHERE parent_user_id=$1 AND student_user_id=$2', [parentId, studentId])
  },

  async listRecords(studentId: string, type: string): Promise<StoredRecord[]> {
    if (config.useMemoryDb) return [...(memory.records.get(recordBucketKey(studentId, type))?.values() ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const result = await query<{ record_id: string; record_type: string; payload: unknown; created_at: string; updated_at: string }>(
      'SELECT record_id,record_type,payload,created_at,updated_at FROM student_records WHERE student_user_id=$1 AND record_type=$2 ORDER BY updated_at DESC', [studentId, type],
    )
    return result.rows.map((row) => ({ id: row.record_id, type: row.record_type, payload: row.payload, createdAt: row.created_at, updatedAt: row.updated_at }))
  },

  async getRecord(studentId: string, type: string, id: string): Promise<StoredRecord | null> {
    if (config.useMemoryDb) return memory.records.get(recordBucketKey(studentId, type))?.get(id) ?? null
    const result = await query<{ record_id: string; record_type: string; payload: unknown; created_at: string; updated_at: string }>(
      'SELECT record_id,record_type,payload,created_at,updated_at FROM student_records WHERE student_user_id=$1 AND record_type=$2 AND record_id=$3', [studentId, type, id],
    )
    const row = result.rows[0]
    return row ? { id: row.record_id, type: row.record_type, payload: row.payload, createdAt: row.created_at, updatedAt: row.updated_at } : null
  },

  async upsertRecord(studentId: string, type: string, id: string, payload: unknown): Promise<StoredRecord> {
    const now = new Date().toISOString()
    if (config.useMemoryDb) {
      const key = recordBucketKey(studentId, type)
      const bucket = memory.records.get(key) ?? new Map<string, StoredRecord>()
      const existing = bucket.get(id)
      const record = { id, type, payload, createdAt: existing?.createdAt ?? now, updatedAt: now }
      bucket.set(id, record)
      memory.records.set(key, bucket)
      return record
    }
    const result = await query<{ record_id: string; record_type: string; payload: unknown; created_at: string; updated_at: string }>(
      `INSERT INTO student_records(student_user_id,record_type,record_id,payload,created_at,updated_at)
       VALUES($1,$2,$3,$4::jsonb,NOW(),NOW())
       ON CONFLICT(student_user_id,record_type,record_id)
       DO UPDATE SET payload=EXCLUDED.payload,updated_at=NOW()
       RETURNING record_id,record_type,payload,created_at,updated_at`, [studentId, type, id, JSON.stringify(payload)],
    )
    const row = result.rows[0]
    if (!row) throw new Error('UPSERT_RETURNED_NO_ROW')
    return { id: row.record_id, type: row.record_type, payload: row.payload, createdAt: row.created_at, updatedAt: row.updated_at }
  },

  async deleteRecord(studentId: string, type: string, id: string) {
    if (config.useMemoryDb) { memory.records.get(recordBucketKey(studentId, type))?.delete(id); return }
    await query('DELETE FROM student_records WHERE student_user_id=$1 AND record_type=$2 AND record_id=$3', [studentId, type, id])
  },
}
