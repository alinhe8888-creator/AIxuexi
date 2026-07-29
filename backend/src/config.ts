const optional = (name: string, fallback = '') => (process.env[name] ?? fallback).trim()
const nodeEnv = optional('NODE_ENV', 'development')
const production = nodeEnv === 'production'
const dbMode = optional('DB_MODE', production ? 'postgres' : 'memory').toLowerCase()
if (!['postgres', 'memory'].includes(dbMode)) throw new Error('DB_MODE must be postgres or memory')
if (production && dbMode !== 'postgres') throw new Error('DB_MODE must be postgres in production')

const databaseUrl = optional('DATABASE_URL')
if (dbMode === 'postgres' && !databaseUrl) {
  throw new Error('Missing environment variable: DATABASE_URL')
}

const configuredJwtSecret = optional('JWT_SECRET')
const jwtSecret = configuredJwtSecret || (production ? '' : 'local-development-only-change-me')
if (!jwtSecret) throw new Error('Missing environment variable: JWT_SECRET')
if (production && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production')
}

const rawCorsOrigins = optional(
  'CORS_ORIGIN',
  production ? '' : 'http://localhost:5173,http://localhost:4173',
)
if (production && !rawCorsOrigins) throw new Error('Missing environment variable: CORS_ORIGIN')
const corsOrigins = rawCorsOrigins
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)
for (const origin of corsOrigins) {
  if (origin === '*') continue
  const url = new URL(origin)
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`Invalid CORS_ORIGIN value: ${origin}`)
  }
}

function boundedNumber(name: string, fallback: number, minimum: number, maximum: number) {
  const raw = optional(name, String(fallback))
  const value = Number(raw)
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`)
  }
  return value
}

export const config = {
  port: Math.trunc(boundedNumber('PORT', 10000, 1, 65535)),
  databaseUrl,
  useMemoryDb: dbMode === 'memory',
  jwtSecret,
  nodeEnv,
  corsOrigins: [...new Set(corsOrigins)],
  aiApiBaseUrl: optional('AI_API_BASE_URL').replace(/\/$/, ''),
  aiApiKey: optional('AI_API_KEY'),
  aiModel: optional('AI_MODEL', 'gpt-4.1-mini'),
  aiVisionModel: optional('AI_VISION_MODEL', optional('AI_MODEL', 'gpt-4.1-mini')),
  maxJsonMb: boundedNumber('MAX_JSON_MB', 30, 8, 200),
  aiTimeoutMs: Math.trunc(boundedNumber('AI_TIMEOUT_MS', 300_000, 30_000, 900_000)),
}
