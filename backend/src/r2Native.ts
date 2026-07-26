import { createHmac, createHash, randomUUID } from 'node:crypto'

const env = (name: string, fallback = '') => (process.env[name] ?? fallback).trim()
const endpointValue = env('R2_ENDPOINT_HOST', env('R2_ENDPOINT'))
const endpointHostFromValue = (() => {
  if (!endpointValue) return ''
  try {
    return new URL(endpointValue.includes('://') ? endpointValue : `https://${endpointValue}`).host
  } catch {
    return endpointValue.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  }
})()
const accountId = env('R2_ACCOUNT_ID')
const accessKeyId = env('R2_ACCESS_KEY_ID', env('R2_ACCESS_KEY'))
const secretAccessKey = env('R2_SECRET_ACCESS_KEY', env('R2_SECRET_KEY'))
const bucket = env('R2_BUCKET_NAME', env('R2_BUCKET'))
const endpointHost = endpointHostFromValue || (accountId ? `${accountId}.r2.cloudflarestorage.com` : '')
const expiresSeconds = Math.min(3600, Math.max(60, Number(env('R2_PRESIGN_SECONDS', '900'))))
const maxZipBytes = Math.max(5, Number(env('MATERIAL_MAX_ZIP_MB', '100'))) * 1024 * 1024

const awsEncode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
const hmac = (key: string | Buffer, value: string) => createHmac('sha256', key).update(value).digest()
const dateStamp = (date: Date) => date.toISOString().slice(0, 10).replaceAll('-', '')
const amzDate = (date: Date) => date.toISOString().replace(/[:-]|\.\d{3}/g, '')

export const isR2Ready = () => Boolean(accountId && accessKeyId && secretAccessKey && bucket && endpointHost)
export const getMaterialMaxZipBytes = () => maxZipBytes

const ownedPrefix = (userId: string) => `users/${userId}/materials/`
export function assertOwnedMaterialKey(userId: string, key: string) {
  if (!key.startsWith(ownedPrefix(userId)) || key.includes('..') || key.includes('\\')) {
    const error = new Error('无权访问该资料文件') as Error & { status?: number }
    error.status = 403
    throw error
  }
}

function signingKey(date: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, date)
  const regionKey = hmac(dateKey, 'auto')
  const serviceKey = hmac(regionKey, 's3')
  return hmac(serviceKey, 'aws4_request')
}

function canonicalUri(key: string) {
  return `/${awsEncode(bucket)}/${key.split('/').map(awsEncode).join('/')}`
}

function presign(method: 'GET' | 'PUT' | 'HEAD' | 'DELETE', key: string, expires = expiresSeconds) {
  if (!isR2Ready()) throw new Error('R2 尚未配置完整')
  const now = new Date()
  const shortDate = dateStamp(now)
  const timestamp = amzDate(now)
  const scope = `${shortDate}/auto/s3/aws4_request`
  const params: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': timestamp,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  }
  const canonicalQuery = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${awsEncode(name)}=${awsEncode(value)}`)
    .join('&')
  const uri = canonicalUri(key)
  const canonicalRequest = [method, uri, canonicalQuery, `host:${endpointHost}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', timestamp, scope, sha256(canonicalRequest)].join('\n')
  const signature = createHmac('sha256', signingKey(shortDate)).update(stringToSign).digest('hex')
  return `https://${endpointHost}${uri}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

const safeStem = (fileName: string) => fileName
  .replace(/\.[^.]+$/, '')
  .normalize('NFKC')
  .replace(/[^\p{L}\p{N}_-]+/gu, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'material'

export function createMaterialZipKey(userId: string, fileName: string) {
  const stamp = new Date().toISOString().slice(0, 10)
  return `${ownedPrefix(userId)}${stamp}/${Date.now()}-${randomUUID()}-${safeStem(fileName)}.zip`
}

export function createExtractedFileKey(userId: string, importId: string, fileName: string) {
  const extension = fileName.includes('.') ? `.${fileName.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}` : ''
  return `${ownedPrefix(userId)}${importId}/files/${Date.now()}-${randomUUID()}-${safeStem(fileName)}${extension}`
}


export function createLearningAssetKey(
  userId: string,
  kind: 'question' | 'paper',
  extension: string,
) {
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'jpg'
  const stamp = new Date().toISOString().slice(0, 10)
  return `users/${userId}/learning-assets/${kind}/${stamp}/${Date.now()}-${randomUUID()}.${safeExtension}`
}

export function createUploadUrl(key: string) {
  return presign('PUT', key)
}

export function createReadUrl(key: string, expires = expiresSeconds) {
  return presign('GET', key, expires)
}

export async function fetchObjectBuffer(key: string): Promise<Buffer> {
  const response = await fetch(createReadUrl(key, 900), { signal: AbortSignal.timeout(180_000) })
  if (!response.ok) throw new Error(`读取 R2 文件失败（${response.status}）`)
  return Buffer.from(await response.arrayBuffer())
}

export async function putObjectBuffer(key: string, body: Buffer, contentType: string) {
  const response = await fetch(createUploadUrl(key), {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: body as unknown as BodyInit,
    signal: AbortSignal.timeout(180_000),
  })
  if (!response.ok) throw new Error(`写入 R2 文件失败（${response.status}）`)
}

export async function headObject(key: string) {
  const response = await fetch(presign('HEAD', key), { method: 'HEAD', signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`R2 文件校验失败（${response.status}）`)
  return {
    size: Number(response.headers.get('content-length') || 0),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  }
}

export async function deleteObject(key: string) {
  const response = await fetch(presign('DELETE', key), { method: 'DELETE', signal: AbortSignal.timeout(30_000) })
  if (!response.ok && response.status !== 404) throw new Error(`删除 R2 文件失败（${response.status}）`)
}
