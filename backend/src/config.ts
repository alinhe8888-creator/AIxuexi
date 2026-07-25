const optional = (name: string, fallback = '') => (process.env[name] ?? fallback).trim()
const first = (...names: string[]) => names.map((name) => optional(name)).find(Boolean) || ''
const required = (name: string, fallback?: string) => { const value = optional(name, fallback); if (!value) throw new Error(`Missing environment variable: ${name}`); return value }
const configuredCorsOrigins = optional('CORS_ORIGIN', 'http://localhost:5173,http://localhost:4173').split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean)
const officialPagesOrigins = ['https://aixuexi-29x.pages.dev', 'https://aixuexi-parent.pages.dev']
const r2Endpoint = first('R2_ENDPOINT', 'S3_ENDPOINT').replace(/\/$/, '')
const r2AccountFromEndpoint = r2Endpoint.match(/^https?:\/\/([^.]+)\.r2\.cloudflarestorage\.com/i)?.[1] || ''
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
  r2Endpoint,
  r2AccountId: first('R2_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID') || r2AccountFromEndpoint,
  r2AccessKeyId: first('R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY'),
  r2SecretAccessKey: first('R2_SECRET_ACCESS_KEY', 'R2_SECRET_KEY'),
  r2Bucket: first('R2_BUCKET_NAME', 'R2_BUCKET'),
  r2PublicBaseUrl: first('R2_PUBLIC_BASE_URL', 'R2_PUBLIC_URL').replace(/\/$/, ''),
}
