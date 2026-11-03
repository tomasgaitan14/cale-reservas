import type { SupabaseClient } from '@supabase/supabase-js'
import { createBusiness } from './businesses.ts'
import { createService } from './services.ts'
import { newUserClient } from './users.ts'
import { saveHours, WEEKDAYS, type HoursRange } from './working-hours.ts'

// Celular inventado en el formato canónico: nunca el de una persona real
export const SAMPLE_PHONE = '5493445550142'
export const SAMPLE_CLIENT_NAME = 'Marina Ledesma'

export const OPENING = '09:00'
export const CLOSING = '18:00'
const DEFAULT_SERVICE_MINUTES = 60
const BUSINESS_NAME = 'Peluquería Lucero'
const SERVICE_NAME = 'Corte de pelo'

export interface BookableBusiness {
  id: string
  slug: string
  serviceId: string
  owner: SupabaseClient
}

interface BookableOptions {
  serviceMinutes?: number
  ranges?: HoursRange[]
}

const weekdayHours = (start: string, end: string): HoursRange[] =>
  WEEKDAYS.map(day => ({ day_of_week: day, start_time: start, end_time: end }))

// Negocio con una dueña, un servicio y horario de lunes a viernes: listo para recibir reservas
export async function newBookableBusiness({ serviceMinutes = DEFAULT_SERVICE_MINUTES, ranges }: BookableOptions = {}): Promise<BookableBusiness> {
  const owner = await newUserClient()
  const business = await createBusiness(owner, BUSINESS_NAME, 'lucero')
  const service = await createService(owner, business.id, SERVICE_NAME, serviceMinutes)
  await saveHours(owner, business.id, ranges ?? weekdayHours(OPENING, CLOSING))
  return { id: business.id, slug: business.slug, serviceId: service.id, owner }
}

export interface BookingRequest {
  slug: string
  serviceId: string
  date: string
  time: string
  name?: string
  phone?: string
  consent?: boolean
}

// Devuelve la respuesta tal cual, con su error si lo hay: para probar los rechazos
export function tryBook(client: SupabaseClient, request: BookingRequest) {
  return client.rpc('create_booking', {
    p_slug: request.slug,
    p_service_id: request.serviceId,
    p_date: request.date,
    p_time: request.time,
    p_client_name: request.name ?? SAMPLE_CLIENT_NAME,
    p_client_phone: request.phone ?? SAMPLE_PHONE,
    p_consent: request.consent ?? true,
  })
}

export async function book(client: SupabaseClient, request: BookingRequest): Promise<void> {
  const { error } = await tryBook(client, request)
  if (error) throw error
}

// Horarios libres que ve quien reserva ('HH:MM')
export async function slotsFor(client: SupabaseClient, slug: string, serviceId: string, date: string): Promise<string[]> {
  const { data, error } = await client.rpc('get_available_slots', { p_slug: slug, p_service_id: serviceId, p_date: date })
  if (error) throw error
  return data as string[]
}
