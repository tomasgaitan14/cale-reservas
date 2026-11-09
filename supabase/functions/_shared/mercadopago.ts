const productionAccessToken = Deno.env.get('MP_ACCESS_TOKEN') ?? ''
const testAccessToken = Deno.env.get('MP_ACCESS_TOKEN_TEST') ?? ''
const productionWebhookSecret = Deno.env.get('MP_WEBHOOK_SECRET') ?? ''
const testWebhookSecret = Deno.env.get('MP_WEBHOOK_SECRET_TEST') ?? ''

export const mercadoPagoAccessToken = productionAccessToken || testAccessToken
export const mercadoPagoUsesProduction = Boolean(productionAccessToken)
export const mercadoPagoWebhookSecret = productionWebhookSecret || testWebhookSecret

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

function parseSignature(value: string) {
  return Object.fromEntries(value.split(',').map(part => {
    const separator = part.indexOf('=')
    return separator < 0 ? [part.trim(), ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
  })) as { ts?: string; v1?: string }
}

export async function verifyMercadoPagoWebhook(request: Request, payloadDataId?: string) {
  if (!mercadoPagoWebhookSecret) return { configured: false, valid: false }
  const signatureHeader = request.headers.get('x-signature')
  const requestId = request.headers.get('x-request-id')
  if (!signatureHeader) return { configured: true, valid: false }
  const signature = parseSignature(signatureHeader)
  if (!signature.ts || !signature.v1) return { configured: true, valid: false }

  const dataId = new URL(request.url).searchParams.get('data.id') ?? payloadDataId ?? ''
  const manifest = [
    dataId ? `id:${dataId};` : '',
    requestId ? `request-id:${requestId};` : '',
    `ts:${signature.ts};`,
  ].join('')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(mercadoPagoWebhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)))
  const calculated = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
  return { configured: true, valid: constantTimeEqual(calculated, signature.v1) }
}
