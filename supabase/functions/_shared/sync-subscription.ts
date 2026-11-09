import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { BILLING_DAY, FULL_PRICE, isBillingDay, nextBillingDate } from './billing.ts'
import { subscriptionReturnUrl } from './environment.ts'

type BillingStatus = 'free' | 'pending' | 'active' | 'past_due' | 'canceled'

function mapStatus(status: string): BillingStatus {
  if (status === 'authorized') return 'active'
  if (status === 'pending') return 'pending'
  if (status === 'paused') return 'past_due'
  if (status === 'cancelled') return 'canceled'
  return 'free'
}

export async function syncSubscription(admin: SupabaseClient, token: string, subscriptionId: string) {
  const mercadoPagoResponse = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  })
  if (!mercadoPagoResponse.ok) return { ok: false as const, status: 502, error: 'subscription_lookup_failed' }

  const subscription = await mercadoPagoResponse.json() as {
    status?: string
    external_reference?: string
    preapproval_plan_id?: string
    next_payment_date?: string
    summarized?: { last_charged_amount?: number | string }
    auto_recurring?: { transaction_amount?: number | string }
  }
  if (!subscription.status) return { ok: true as const, status: 'unknown' }

  let businessId = subscription.external_reference ?? ''
  if (!businessId && subscription.preapproval_plan_id) {
    const { data: planBilling } = await admin.from('business_billing')
      .select('business_id')
      .eq('mercadopago_plan_id', subscription.preapproval_plan_id)
      .maybeSingle()
    businessId = planBilling?.business_id ?? ''
  }
  if (!businessId) return { ok: true as const, status: 'unknown' }

  const billingStatus = mapStatus(subscription.status)
  const { data: billing } = await admin.from('business_billing')
    .select('promotion_code, promotion_price, initial_charge_amount, billing_day_configured_at, billing_day, current_period_end, mercadopago_subscription_id, mercadopago_plan_id')
    .eq('business_id', businessId)
    .maybeSingle()
  if (!billing) return { ok: true as const, status: billingStatus, businessId }

  const isPlanSubscription = Boolean(
    subscription.preapproval_plan_id && billing.mercadopago_plan_id === subscription.preapproval_plan_id,
  )
  const belongsToAnotherSubscription = Boolean(
    billing.mercadopago_subscription_id && billing.mercadopago_subscription_id !== subscriptionId && !isPlanSubscription,
  )
  const belongsToAnotherPlan = Boolean(
    billing.mercadopago_plan_id && subscription.preapproval_plan_id && billing.mercadopago_plan_id !== subscription.preapproval_plan_id && !belongsToAnotherSubscription,
  )
  if (belongsToAnotherSubscription || belongsToAnotherPlan) return { ok: true as const, status: 'unknown' }

  const chargedAmountValue = subscription.summarized?.last_charged_amount ?? subscription.auto_recurring?.transaction_amount
  const chargedAmount = typeof chargedAmountValue === 'number' ? chargedAmountValue : typeof chargedAmountValue === 'string' ? Number(chargedAmountValue) : null
  const promotionWasUsed = billingStatus === 'active' && billing.promotion_code === 'DESCUENTOCALE50' && chargedAmount !== null && chargedAmount <= Number(billing.promotion_price) + 0.01
  const prorationWasUsed = billingStatus === 'active' && billing.initial_charge_amount !== null && billing.initial_charge_amount !== undefined && chargedAmount !== null && chargedAmount <= Number(billing.initial_charge_amount) + 0.01
  const storedNextPaymentDate = subscription.next_payment_date ? new Date(subscription.next_payment_date) : null
  const shouldConfigureBilling = billingStatus === 'active' && (!billing.billing_day_configured_at || !storedNextPaymentDate || !isBillingDay(storedNextPaymentDate, billing.billing_day ?? BILLING_DAY))
  let nextPaymentDate = subscription.next_payment_date ?? billing.current_period_end ?? null

  if (shouldConfigureBilling || promotionWasUsed || prorationWasUsed) {
    const regularizationUrl = isPlanSubscription && promotionWasUsed
      ? `https://api.mercadopago.com/preapproval_plan/${encodeURIComponent(subscription.preapproval_plan_id ?? billing.mercadopago_plan_id ?? '')}`
      : `https://api.mercadopago.com/preapproval/${encodeURIComponent(subscriptionId)}`
    const regularizeResponse = await fetch(regularizationUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        back_url: subscriptionReturnUrl(),
        auto_recurring: {
          transaction_amount: FULL_PRICE,
          currency_id: 'ARS',
          billing_day: BILLING_DAY,
          ...(isPlanSubscription && promotionWasUsed ? { billing_day_proportional: false } : {}),
        },
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!regularizeResponse.ok) return { ok: false as const, status: 502, error: 'billing_regularization_failed' }
    const regularizedSubscription = await regularizeResponse.json() as { next_payment_date?: string }
    nextPaymentDate = regularizedSubscription.next_payment_date ?? nextBillingDate(new Date(), BILLING_DAY)
  }

  const { error } = await admin.from('business_billing').update({
    billing_status: billingStatus,
    last_payment_status: subscription.status,
    current_period_end: nextPaymentDate,
    billing_day: billing.billing_day ?? BILLING_DAY,
    mercadopago_subscription_id: subscriptionId,
    mercadopago_plan_id: isPlanSubscription ? subscription.preapproval_plan_id : billing.mercadopago_plan_id,
    initial_charge_amount: isPlanSubscription || prorationWasUsed || promotionWasUsed ? null : billing.initial_charge_amount ?? null,
    billing_day_configured_at: shouldConfigureBilling || (isPlanSubscription && billingStatus === 'active') ? new Date().toISOString() : undefined,
    promotion_code: promotionWasUsed ? null : billing.promotion_code ?? null,
    promotion_price: promotionWasUsed ? null : billing.promotion_price ?? null,
    promotion_applied_at: promotionWasUsed ? null : undefined,
    updated_at: new Date().toISOString(),
  }).eq('business_id', businessId)
  if (error) return { ok: false as const, status: 503, error: 'billing_state_unavailable' }

  const periodEndTimestamp = nextPaymentDate ? Date.parse(nextPaymentDate) : NaN
  const keepsProDuringCanceledPeriod = billingStatus === 'canceled' && Number.isFinite(periodEndTimestamp) && periodEndTimestamp > Date.now()
  const hasProEntitlement = billingStatus === 'active' || keepsProDuringCanceledPeriod
  const { error: planError } = await admin.from('businesses').update({ plan: hasProEntitlement ? 'pro' : 'gratis' }).eq('id', businessId)
  if (planError) return { ok: false as const, status: 503, error: 'business_plan_unavailable' }
  return { ok: true as const, status: billingStatus, businessId, nextPaymentDate }
}

export async function syncPlanSubscriptions(admin: SupabaseClient, token: string, planId: string) {
  const searchResponse = await fetch(`https://api.mercadopago.com/preapproval/search?preapproval_plan_id=${encodeURIComponent(planId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  })
  if (!searchResponse.ok) return { ok: false as const, status: 502, error: 'subscription_lookup_failed' }
  const searchData = await searchResponse.json() as { results?: Array<{ id?: string }> }
  const subscriptionIds = (searchData.results ?? []).map(item => item.id).filter((id): id is string => Boolean(id))
  if (!subscriptionIds.length) return { ok: true as const, status: 'pending' }

  let status: BillingStatus = 'pending'
  for (const subscriptionId of subscriptionIds) {
    const result = await syncSubscription(admin, token, subscriptionId)
    if (!result.ok) return result
    const resultStatus: BillingStatus | 'unknown' = result.status as BillingStatus | 'unknown'
    if (resultStatus !== 'unknown') status = resultStatus
  }
  return { ok: true as const, status }
}
