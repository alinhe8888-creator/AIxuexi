const optional = (name: string, fallback = '') => (process.env[name] ?? fallback).trim()
const required = (name: string, fallback?: string) => {
  const value = optional(name, fallback)
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

const configuredCorsOrigins = optional('CORS_ORIGIN', 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)

const officialPagesOrigins = [
  'https://aixuexi-29x.pages.dev',
  'https://aixuexi-parent.pages.dev',
]

export const config = {
  port: Number(process.env.PORT || 10000),
  databaseUrl: optional('DATABASE_URL'),
  useMemoryDb: optional('DB_MODE').toLowerCase() === 'memory' || !optional('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET', 'local-development-only-change-me'),
  nodeEnv: optional('NODE_ENV', 'development'),
  corsOrigins: [...new Set([...configuredCorsOrigins, ...officialPagesOrigins])],
  aiApiBaseUrl: optional('AI_API_BASE_URL').replace(/\/$/, ''),
  aiApiKey: optional('AI_API_KEY'),
  aiModel: optional('AI_MODEL', 'gpt-4.1-mini'),
  aiVisionModel: optional('AI_VISION_MODEL', optional('AI_MODEL', 'gpt-4.1-mini')),
  maxJsonMb: Math.max(8, Number(process.env.MAX_JSON_MB || 30)),
}
