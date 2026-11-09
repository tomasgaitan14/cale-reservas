import { createClient } from 'npm:@supabase/supabase-js@2'
import { jsonResponse, preflightResponse } from '../_shared/cors.ts'
import { readAllowedOrigins } from '../_shared/environment.ts'
import { syncSubscription } from '../_shared/sync-subscription.ts'
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
  const businessId = body && typeof body === 'object' && !Array.isArray(body) && typeof (body as { businessId?: unknown }).businessId === 'string' ? (body as { businessId: string }).businessId : ''
  if (!businessId) return reply(400, { error: 'invalid_request' })
  const { data: membership } = await admin.from('business_members').select('business_id').eq('business_id', businessId).eq('user_id', userData.user.id).maybeSingle()
  if (!membership) return reply(403, { error: 'forbidden' })
  const { data: billing } = await admin.from('business_billing').select('mercadopago_subscription_id, mercadopago_plan_id').eq('business_id', businessId).maybeSingle()
  let subscriptionId = billing?.mercadopago_subscription_id ?? ''
  if (!subscriptionId && billing?.mercadopago_plan_id) {
    const searchResponse = await fetch(`https://api.mercadopago.com/preapproval/search?preapproval_plan_id=${encodeURIComponent(billing.mercadopago_plan_id)}`, {
      headers: { Authorization: `Bearer ${mercadoPagoToken}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!searchResponse.ok) return reply(502, { error: 'subscription_lookup_failed' })
    const searchData = await searchResponse.json() as { results?: Array<{ id?: string; external_reference?: string; preapproval_plan_id?: string }> }
    const matchingSubscription = searchData.results?.find(item =>
      item.id && (item.external_reference === businessId || item.preapproval_plan_id === billing.mercadopago_plan_id),
    )
    subscriptionId = matchingSubscription?.id ?? ''
  }
  if (!subscriptionId) return reply(200, { status: 'pending' })
  const result = await syncSubscription(admin, mercadoPagoToken, subscriptionId)
  if (!result.ok) return reply(result.status, { error: result.error })
  return reply(200, { status: result.status })
})
