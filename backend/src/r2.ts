import { createHash, createHmac } from 'node:crypto'
import { config } from './config.js'

const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest()
const dateParts = (date: Date) => {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amzDate: iso, shortDate: iso.slice(0, 8) }
}
const canonicalPath = (key: string) => `/${encode(config.r2Bucket)}/${key.split('/').map(encode).join('/')}`

export function isR2Configured() {
  return Boolean((config.r2Endpoint || config.r2AccountId) && config.r2AccessKeyId && config.r2SecretAccessKey && config.r2Bucket)
}

export function createR2SignedUrl(method: 'GET' | 'PUT' | 'DELETE', key: string, expiresIn = 600) {
  if (!isR2Configured()) throw new Error('R2_NOT_CONFIGURED')
  const now = new Date()
  const { amzDate, shortDate } = dateParts(now)
  const host = config.r2Endpoint ? new URL(config.r2Endpoint).host : `${config.r2AccountId}.r2.cloudflarestorage.com`
  const scope = `${shortDate}/auto/s3/aws4_request`
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.r2AccessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(Math.min(3600, Math.max(60, expiresIn))),
    'X-Amz-SignedHeaders': 'host',
  })
  const canonicalQuery = [...query.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `${encode(name)}=${encode(value)}`).join('&')
  const request = [method, canonicalPath(key), canonicalQuery, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, hash(request)].join('\n')
  const dateKey = hmac(`AWS4${config.r2SecretAccessKey}`, shortDate)
  const regionKey = hmac(dateKey, 'auto')
  const serviceKey = hmac(regionKey, 's3')
  const signingKey = hmac(serviceKey, 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')
  query.set('X-Amz-Signature', signature)
  return `https://${host}${canonicalPath(key)}?${query.toString()}`
}
