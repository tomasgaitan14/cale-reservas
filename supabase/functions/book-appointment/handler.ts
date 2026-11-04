interface Config {
  origins: string[]
  hostnames: string[]
  secret: string
  supabaseUrl: string
  serverKey: string
}
export function bookingHandler(config: Config, requestFetch: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin') ?? ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' }
    if (config.origins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
    if (!config.origins.includes(origin)) return reply(403, { error: 'origin_not_allowed' })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization' } })
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
    if (!config.secret || !config.serverKey || !config.hostnames.length) return reply(503, { error: 'booking_unavailable' })
    // Limitar bytes antes de interpretar JSON, sin registrar datos de quien reserva.
    const reader = request.body?.getReader()
    if (!reader) return reply(400, { error: 'invalid_request' })
    let size = 0
    const chunks: Uint8Array[] = []
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 8192) { await reader.cancel(); return reply(413, { error: 'request_too_large' }) }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      const body = JSON.parse(new TextDecoder().decode(bytes))
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'invalid_request' })
      const { slug, serviceId, date, time, name, phone, consent, token } = body
      if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 40 ||
          typeof serviceId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId) ||
          typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
          typeof name !== 'string' || !name.trim() || name.trim().length > 80 ||
          typeof phone !== 'string' || !/^\d{10,15}$/.test(phone) || consent !== true ||
          typeof token !== 'string' || !token || token.length > 2048) return reply(400, { error: 'invalid_request' })
      const verification = await requestFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', body: new URLSearchParams({ secret: config.secret, response: token }), signal: AbortSignal.timeout(8000),
      })
      if (!verification.ok) return reply(503, { error: 'verification_unavailable' })
      const verified = await verification.json()
      if (verified.success !== true || verified.action !== 'booking' || !config.hostnames.includes(verified.hostname)) return reply(400, { error: 'verification_failed' })
      const response = await requestFetch(`${config.supabaseUrl}/rest/v1/rpc/create_booking`, {
        method: 'POST', headers: { apikey: config.serverKey, Authorization: `Bearer ${config.serverKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_slug: slug, p_service_id: serviceId, p_date: date, p_time: time, p_client_name: name.trim(), p_client_phone: phone, p_consent: consent }),
        signal: AbortSignal.timeout(10000),
      })
      const result = await response.json()
      if (!response.ok) {
        const allowed = ['slot_unavailable', 'consent_required', 'too_many_bookings', 'business_not_found']
        return reply(response.status === 429 ? 429 : 400, { error: allowed.includes(result.message) ? result.message : 'booking_failed' })
      }
      return reply(200, { confirmation: result })
    } catch (error) {
      return reply(error instanceof SyntaxError ? 400 : 503, { error: error instanceof SyntaxError ? 'invalid_request' : 'booking_unavailable' })
    }
  }
}
