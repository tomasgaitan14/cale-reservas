import { createClient } from 'npm:@supabase/supabase-js@2'
import { syncPlanSubscriptions, syncSubscription } from '../_shared/sync-subscription.ts'
import { mercadoPagoAccessToken, mercadoPagoUsesProduction, verifyMercadoPagoWebhook } from '../_shared/mercadopago.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const mercadoPagoToken = mercadoPagoAccessToken
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  if (!supabaseUrl || !serviceRoleKey || !mercadoPagoToken) return Response.json({ error: 'billing_unavailable' }, { status: 503 })
  try {
    const payload = await request.json() as { data?: { id?: string }; id?: string; type?: string; topic?: string }
    const signature = await verifyMercadoPagoWebhook(request, payload.data?.id)
    if ((signature.configured && !signature.valid) || (mercadoPagoUsesProduction && !signature.configured)) return Response.json({ error: 'invalid_webhook_signature' }, { status: 401 })
    const notificationType = payload.type ?? payload.topic ?? new URL(request.url).searchParams.get('type') ?? ''
    const resourceId = payload.data?.id ?? payload.id
    if (!resourceId) return Response.json({ received: true })

    if (notificationType === 'subscription_preapproval_plan' || notificationType === 'plan') {
      const result = await syncPlanSubscriptions(admin, mercadoPagoToken, resourceId)
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status })
      return Response.json({ received: true })
    }

    let subscriptionId = resourceId
    if (notificationType === 'payment') {
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(resourceId)}`, {
        headers: { Authorization: `Bearer ${mercadoPagoToken}` },
        signal: AbortSignal.timeout(10000),
      })
      if (!paymentResponse.ok) return Response.json({ error: 'payment_lookup_failed' }, { status: 502 })
      const payment = await paymentResponse.json() as { preapproval_id?: string }
      if (!payment.preapproval_id) return Response.json({ received: true })
      subscriptionId = payment.preapproval_id
    }

    if (!subscriptionId || typeof subscriptionId !== 'string') return Response.json({ received: true })

    const result = await syncSubscription(admin, mercadoPagoToken, subscriptionId)
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status })
    return Response.json({ received: true })
  } catch { return Response.json({ error: 'invalid_notification' }, { status: 400 }) }
})
