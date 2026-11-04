import { describeServiceError, type ServiceFormErrors } from './service-errors.ts'
import { supabase } from './supabase.ts'

export interface Service {
  id: string
  name: string
  duration_minutes: number
  active: boolean
}

export interface ServiceInput {
  name: string
  duration_minutes: number
}

const SERVICE_COLUMNS = 'id, name, duration_minutes, active'

export class ServiceLoadError extends Error {
  constructor(detail: string) {
    super(`No se pudieron leer los servicios: ${detail}`)
    this.name = 'ServiceLoadError'
  }
}

export type ServiceResult = { ok: true } | { ok: false; errors: ServiceFormErrors }

function toResult(error: { code?: string; message?: string } | null): ServiceResult {
  return error ? { ok: false, errors: describeServiceError(error) } : { ok: true }
}

// La seguridad por filas deja ver solo los servicios de los negocios de la persona
export async function fetchServices(businessId: string): Promise<Service[]> {
  const { data, error } = await supabase.from('services').select(SERVICE_COLUMNS).eq('business_id', businessId).order('created_at')
  if (error) throw new ServiceLoadError(error.message)
  return data as Service[]
}

export async function createService(businessId: string, input: ServiceInput): Promise<ServiceResult> {
  const { error } = await supabase.from('services').insert({ business_id: businessId, ...input })
  return toResult(error)
}

export async function updateService(id: string, changes: Partial<ServiceInput & { active: boolean }>): Promise<ServiceResult> {
  const { error } = await supabase.from('services').update(changes).eq('id', id)
  return toResult(error)
}

export async function deleteService(id: string): Promise<ServiceResult> {
  const { error } = await supabase.from('services').delete().eq('id', id)
  return toResult(error)
}
