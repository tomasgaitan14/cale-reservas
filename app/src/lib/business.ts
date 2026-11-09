import { describeCreateBusinessError, type BusinessFormErrors } from './business-errors.ts'
import { supabase } from './supabase.ts'

export interface Business {
  id: string
  slug: string
  name: string
  whatsapp: string
  created_at?: string
  plan?: 'gratis' | 'pro' | 'enterprise'
  billing_status?: 'free' | 'pending' | 'active' | 'past_due' | 'canceled'
  current_period_end?: string | null
}

export interface PublicBusiness {
  name: string
  slug: string
  logo_path: string | null
}

const BUSINESS_COLUMNS = 'id, slug, name, whatsapp, created_at, plan'

export class BusinessLoadError extends Error {
  constructor(detail: string) {
    super(`No se pudo leer el negocio: ${detail}`)
    this.name = 'BusinessLoadError'
  }
}

export async function fetchPublicBusinesses(): Promise<PublicBusiness[]> {
  const { data, error } = await supabase.rpc('get_public_businesses')
  if (error) throw new BusinessLoadError(error.message)
  if (!Array.isArray(data)) return []
  return data.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const value = item as Record<string, unknown>
    if (typeof value.name !== 'string' || typeof value.slug !== 'string' || (value.logo_path !== null && typeof value.logo_path !== 'string')) return []
    return [{ name: value.name, slug: value.slug, logo_path: value.logo_path }]
  })
}

// La seguridad por filas deja ver solo los negocios de la persona que entró: en el MVP tiene uno
export async function fetchMyBusiness(): Promise<Business | null> {
  const { data, error } = await supabase.from('businesses').select(BUSINESS_COLUMNS).order('created_at').limit(1)
  if (error) throw new BusinessLoadError(error.message)
  const business = (data?.[0] as Business | undefined) ?? null
  if (!business) return null
  const { data: billing } = await supabase.from('business_billing').select('billing_status, current_period_end').eq('business_id', business.id).maybeSingle()
  const billingStatus = (billing?.billing_status as Business['billing_status'] | undefined) ?? 'free'
  const currentPeriodEnd = billing?.current_period_end ?? null
  const periodEndTimestamp = currentPeriodEnd ? Date.parse(currentPeriodEnd) : NaN
  const canceledPeriodExpired = business.plan === 'pro' && billingStatus === 'canceled' && Number.isFinite(periodEndTimestamp) && periodEndTimestamp <= Date.now()
  if (canceledPeriodExpired) {
    try {
      await supabase.functions.invoke('sync-pro-subscription', { body: { businessId: business.id } })
      const { data: refreshedBusiness } = await supabase.from('businesses').select(BUSINESS_COLUMNS).eq('id', business.id).maybeSingle()
      const { data: refreshedBilling } = await supabase.from('business_billing').select('billing_status, current_period_end').eq('business_id', business.id).maybeSingle()
      if (refreshedBusiness) {
        return {
          ...(refreshedBusiness as Business),
          billing_status: (refreshedBilling?.billing_status as Business['billing_status'] | undefined) ?? 'free',
          current_period_end: refreshedBilling?.current_period_end ?? null,
        }
      }
    } catch {
      // Si la sincronización falla, conservamos el estado conocido hasta el próximo intento.
    }
  }
  return { ...business, billing_status: billingStatus, current_period_end: currentPeriodEnd }
}

export interface NewBusinessInput {
  name: string
  slug: string
  whatsapp: string
  plan?: Business['plan']
}

export type CreateBusinessResult = { ok: true; business: Business } | { ok: false; errors: BusinessFormErrors }

export async function createBusiness(input: NewBusinessInput): Promise<CreateBusinessResult> {
  const { data, error } = await supabase.rpc('create_business', {
    p_name: input.name,
    p_slug: input.slug,
    p_whatsapp: input.whatsapp,
  })
  if (error) return { ok: false, errors: describeCreateBusinessError(error) }
  const business = data as Business
  return { ok: true, business: { ...business, plan: 'gratis' } }
}
