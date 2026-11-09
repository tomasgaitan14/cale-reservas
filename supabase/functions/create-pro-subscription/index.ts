import { createClient } from 'npm:@supabase/supabase-js@2'
import { BILLING_DAY, FULL_PRICE } from '../_shared/billing.ts'
import { mercadoPagoAccessToken } from '../_shared/mercadopago.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const mercadoPagoToken = mercadoPagoAccessToken
const appUrl = Deno.env.get('APP_URL') ?? 'https://cale.com.ar'
const PROMO_CODE = 'DESCUENTOCALE50'
const PROMO_PRICE = 7499

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

function reply(status: number, body: unknown) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': 'https://cale.com.ar',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
  })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': 'https://cale.com.ar',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
  if (!supabaseUrl || !serviceRoleKey || !mercadoPagoToken) return reply(503, { error: 'billing_unavailable' })

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'unauthorized' })
  const accessToken = authorization.slice('Bearer '.length)
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken)
  if (userError || !userData.user?.email) return reply(401, { error: 'unauthorized' })

  let body: unknown
  try { body = await request.json() } catch { return reply(400, { error: 'invalid_request' }) }
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof (body as { businessId?: unknown }).businessId !== 'string') return reply(400, { error: 'invalid_request' })
  const requestBody = body as { businessId: string; couponCode?: unknown }
  const businessId = requestBody.businessId
  const couponCode = typeof requestBody.couponCode === 'string' ? requestBody.couponCode.trim().toUpperCase() : ''

  const { data: membership } = await admin.from('business_members').select('business_id').eq('business_id', businessId).eq('user_id', userData.user.id).maybeSingle()
  if (!membership) return reply(403, { error: 'forbidden' })
  const { data: business } = await admin.from('businesses').select('plan, created_at').eq('id', businessId).maybeSingle()
  if (!business) return reply(404, { error: 'business_not_found' })
  const createdAt = new Date(business.created_at).getTime()
  const offerEligible = business.plan === 'gratis' && Number.isFinite(createdAt) && Date.now() - createdAt >= 14 * 24 * 60 * 60 * 1000
  const hasValidPromotion = couponCode === PROMO_CODE && offerEligible
  if (couponCode && !hasValidPromotion) return reply(409, { error: 'coupon_not_available' })
  const { data: billing } = await admin.from('business_billing').select('billing_exempt, mercadopago_subscription_id, mercadopago_plan_id').eq('business_id', businessId).maybeSingle()
  if (billing?.billing_exempt) return reply(409, { error: 'billing_exempt' })
  if (billing?.mercadopago_subscription_id) {
    const existingResponse = await fetch(`https://api.mercadopago.com/preapproval/${billing.mercadopago_subscription_id}`, {
      headers: { Authorization: `Bearer ${mercadoPagoToken}` },
      signal: AbortSignal.timeout(10000),
    })
    if (existingResponse.ok) {
      const existingSubscription = await existingResponse.json() as { status?: string; init_point?: string; sandbox_init_point?: string }
      const existingCheckoutUrl = existingSubscription.sandbox_init_point ?? existingSubscription.init_point
      if (existingSubscription.status !== 'cancelled' && existingCheckoutUrl) return reply(200, { checkoutUrl: existingCheckoutUrl })
      if (existingSubscription.status !== 'cancelled') return reply(409, { error: 'subscription_exists' })
    }
    // Si la suscripción anterior fue cancelada, se permite crear una nueva.
  }
  if (billing?.mercadopago_plan_id) {
    const existingPlanResponse = await fetch(`https://api.mercadopago.com/preapproval_plan/${encodeURIComponent(billing.mercadopago_plan_id)}`, {
      headers: { Authorization: `Bearer ${mercadoPagoToken}` },
      signal: AbortSignal.timeout(10000),
    })
    if (existingPlanResponse.ok) {
      const existingPlan = await existingPlanResponse.json() as { status?: string; init_point?: string; sandbox_init_point?: string }
      const existingCheckoutUrl = existingPlan.sandbox_init_point ?? existingPlan.init_point
      if (existingPlan.status !== 'cancelled' && existingCheckoutUrl) return reply(200, { checkoutUrl: existingCheckoutUrl })
    }
  }

  const recurringAmount = hasValidPromotion ? PROMO_PRICE : FULL_PRICE

  const mercadoPagoResponse = await fetch('https://api.mercadopago.com/preapproval_plan', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mercadoPagoToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason: 'Cale Pro',
      external_reference: businessId,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        billing_day: BILLING_DAY,
        billing_day_proportional: true,
        transaction_amount: recurringAmount,
        currency_id: 'ARS',
      },
      back_url: `${appUrl}/panel/ajustes?subscription=success`,
    }),
    signal: AbortSignal.timeout(10000),
  })
  if (!mercadoPagoResponse.ok) {
    let providerError: { error?: string; message?: string; cause?: Array<{ code?: string; description?: string }> } = {}
    try { providerError = await mercadoPagoResponse.json() as typeof providerError } catch { /* El proveedor puede responder sin JSON. */ }
    console.error('[billing-debug] mercado_pago_plan_rejected', JSON.stringify({
      status: mercadoPagoResponse.status,
      error: providerError.error,
      message: providerError.message,
      causes: providerError.cause?.map(item => ({ code: item.code, description: item.description })),
    }))
    return reply(502, {
      error: 'subscription_creation_failed',
      providerStatus: mercadoPagoResponse.status,
      providerCode: providerError.cause?.[0]?.code ?? providerError.error ?? null,
    })
  }
  const plan = await mercadoPagoResponse.json() as { id?: string; init_point?: string; sandbox_init_point?: string }
  if (!plan.id || !(plan.sandbox_init_point || plan.init_point)) return reply(502, { error: 'subscription_plan_response_invalid' })

  const { error: saveError } = await admin.from('business_billing').update({
    mercadopago_subscription_id: null,
    mercadopago_plan_id: plan.id,
    billing_status: 'pending',
    last_payment_status: 'pending',
    billing_day: BILLING_DAY,
    initial_charge_amount: null,
    billing_day_configured_at: null,
    promotion_code: hasValidPromotion ? PROMO_CODE : null,
    promotion_price: hasValidPromotion ? PROMO_PRICE : null,
    promotion_applied_at: hasValidPromotion ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('business_id', businessId)
  if (saveError) return reply(503, { error: 'billing_state_unavailable' })
  return reply(200, { checkoutUrl: plan.sandbox_init_point ?? plan.init_point })
})
