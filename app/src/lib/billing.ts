import { supabase } from './supabase.ts'

export async function startProSubscription(businessId: string, couponCode?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-pro-subscription', { body: { businessId, ...(couponCode ? { couponCode } : {}) } })
  if (error) {
    let detail = ''
    const context = 'context' in error ? error.context : null
    if (context instanceof Response) {
      const body = await context.clone().json().catch(() => null) as { providerStatus?: unknown; providerCode?: unknown } | null
      if (typeof body?.providerStatus === 'number') detail = ` Código ${body.providerStatus}${typeof body.providerCode === 'string' ? ` (${body.providerCode})` : ''}.`
    }
    throw new Error(`No pudimos iniciar la suscripción.${detail} Probá nuevamente.`)
  }
  if (!data || typeof data.checkoutUrl !== 'string' || !data.checkoutUrl) throw new Error('Mercado Pago no devolvió un enlace de pago válido.')
  return data.checkoutUrl
}

export async function cancelProSubscription(businessId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('cancel-pro-subscription', { body: { businessId } })
  if (error) throw new Error('No pudimos dar de baja Pro. Probá nuevamente.')
}

export async function syncProSubscription(businessId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-pro-subscription', { body: { businessId } })
  if (error) throw new Error('No pudimos confirmar la suscripción todavía.')
}
