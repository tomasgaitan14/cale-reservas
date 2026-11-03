import { describeCreateBusinessError, type BusinessFormErrors } from './business-errors.ts'
import { supabase } from './supabase.ts'

export interface Business {
  id: string
  slug: string
  name: string
  whatsapp: string
}

const BUSINESS_COLUMNS = 'id, slug, name, whatsapp'

export class BusinessLoadError extends Error {
  constructor(detail: string) {
    super(`No se pudo leer el negocio: ${detail}`)
    this.name = 'BusinessLoadError'
  }
}

// La seguridad por filas deja ver solo los negocios de la persona que entró: en el MVP tiene uno
export async function fetchMyBusiness(): Promise<Business | null> {
  const { data, error } = await supabase.from('businesses').select(BUSINESS_COLUMNS).order('created_at').limit(1)
  if (error) throw new BusinessLoadError(error.message)
  return (data?.[0] as Business | undefined) ?? null
}

export interface NewBusinessInput {
  name: string
  slug: string
  whatsapp: string
}

export type CreateBusinessResult = { ok: true; business: Business } | { ok: false; errors: BusinessFormErrors }

export async function createBusiness(input: NewBusinessInput): Promise<CreateBusinessResult> {
  const { data, error } = await supabase.rpc('create_business', {
    p_name: input.name,
    p_slug: input.slug,
    p_whatsapp: input.whatsapp,
  })
  if (error) return { ok: false, errors: describeCreateBusinessError(error) }
  return { ok: true, business: data as Business }
}
