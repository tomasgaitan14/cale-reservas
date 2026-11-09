import { createClient } from 'npm:@supabase/supabase-js@2'
import { jsonResponse, preflightResponse } from '../_shared/cors.ts'
import { readAllowedOrigins } from '../_shared/environment.ts'
import { mercadoPagoAccessToken } from '../_shared/mercadopago.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const mercadoPagoToken = mercadoPagoAccessToken
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const allowedOrigins = readAllowedOrigins()

Deno.serve(async request => {
  const reply = (status: number, body: unknown) => jsonResponse(request, allowedOrigins, status, body)
  if (request.method === 'OPTIONS') return preflightResponse(request, allowedOrigins)
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
  if (!supabaseUrl || !serviceRoleKey || !mercadoPagoToken) return reply(503, { error: 'billing_unavailable' })
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'unauthorized' })
  const { data: userData, error: userError } = await admin.auth.getUser(authorization.slice('Bearer '.length))
  if (userError || !userData.user) return reply(401, { error: 'unauthorized' })
  let body: unknown
  try { body = await request.json() } catch { return reply(400, { error: 'invalid_request' }) }
  if (!body || typeof body !== 'object' || typeof (body as { businessId?: unknown }).businessId !== 'string') return reply(400, { error: 'invalid_request' })
  const businessId = (body as { businessId: string }).businessId
  const { data: membership } = await admin.from('business_members').select('business_id').eq('business_id', businessId).eq('user_id', userData.user.id).maybeSingle()
  if (!membership) return reply(403, { error: 'forbidden' })
  const { data: billing } = await admin.from('business_billing').select('mercadopago_subscription_id, current_period_end').eq('business_id', businessId).maybeSingle()
  if (!billing?.mercadopago_subscription_id) return reply(409, { error: 'subscription_not_found' })
  const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(billing.mercadopago_subscription_id)}`, { method: 'PUT', headers: { Authorization: `Bearer ${mercadoPagoToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }), signal: AbortSignal.timeout(10000) })
  if (!response.ok) return reply(502, { error: 'subscription_cancellation_failed' })
  const periodEnd = billing.current_period_end ?? null
  const { error: billingError } = await admin.from('business_billing').update({ billing_status: 'canceled', last_payment_status: 'canceled', current_period_end: periodEnd, updated_at: new Date().toISOString() }).eq('business_id', businessId)
  if (billingError) return reply(503, { error: 'billing_state_unavailable' })
  return reply(200, { canceled: true, accessUntil: periodEnd })
})
