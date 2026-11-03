import { describeBookingError, type BookingFormErrors } from './booking-errors.ts'
import { supabase } from './supabase.ts'

export interface PublicService {
  id: string
  name: string
  duration_minutes: number
}

export interface BookingInfo {
  name: string
  slug: string
  services: PublicService[]
  // Días de la semana en que atiende: 0 es domingo
  open_days: number[]
}

export class BookingLoadError extends Error {
  constructor(detail: string) {
    super(`No se pudo leer la página de reservas: ${detail}`)
    this.name = 'BookingLoadError'
  }
}

// null si el negocio no existe
export async function fetchBookingInfo(slug: string): Promise<BookingInfo | null> {
  const { data, error } = await supabase.rpc('get_public_booking_info', { p_slug: slug })
  if (error) throw new BookingLoadError(error.message)
  return (data as BookingInfo | null) ?? null
}

// Horarios libres de un servicio en un día, como 'HH:MM'
export async function fetchSlots(slug: string, serviceId: string, date: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_available_slots', { p_slug: slug, p_service_id: serviceId, p_date: date })
  if (error) throw new BookingLoadError(error.message)
  return data as string[]
}

export interface BookingRequest {
  slug: string
  serviceId: string
  date: string
  time: string
  name: string
  // Ya normalizado: solo dígitos, con código de país
  phone: string
  consent: boolean
}

export interface BookingConfirmation {
  business_name: string
  service_name: string
  date: string
  time: string
}

export type BookingResult = { ok: true; confirmation: BookingConfirmation } | { ok: false; errors: BookingFormErrors }

export async function createBooking(request: BookingRequest): Promise<BookingResult> {
  const { data, error } = await supabase.rpc('create_booking', {
    p_slug: request.slug,
    p_service_id: request.serviceId,
    p_date: request.date,
    p_time: request.time,
    p_client_name: request.name,
    p_client_phone: request.phone,
    p_consent: request.consent,
  })
  if (error) return { ok: false, errors: describeBookingError(error) }
  return { ok: true, confirmation: data as BookingConfirmation }
}
