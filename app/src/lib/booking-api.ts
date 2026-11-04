import type { Branding } from './branding.ts'
import { describeBookingError, type BookingFormErrors } from './booking-errors.ts'
import { supabase } from './supabase.ts'

export interface PublicService {
  id: string
  name: string
  duration_minutes: number
}

export interface BookingInfo {
  whatsapp?: string
  branding?: Branding | null
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
  token: string
}

export interface BookingConfirmation {
  business_name: string
  service_name: string
  date: string
  time: string
}

export type BookingResult = { ok: true; confirmation: BookingConfirmation } | { ok: false; errors: BookingFormErrors }

export async function createBooking(request: BookingRequest): Promise<BookingResult> {
  if (!request.token) return { ok: false, errors: { general: 'Completá la verificación para reservar.' } }
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/book-appointment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify(request), signal: AbortSignal.timeout(20000),
    })
    const result = await response.json()
    if (!response.ok) {
      if (['verification_failed', 'verification_unavailable'].includes(result.error)) return { ok: false, errors: { general: 'No pudimos verificar la reserva. Probá nuevamente.' } }
      return { ok: false, errors: describeBookingError({ message: result.error }) }
    }
    if (!result.confirmation || !['business_name', 'service_name', 'date', 'time'].every(key => typeof result.confirmation[key] === 'string')) throw new Error('invalid_confirmation')
    return { ok: true, confirmation: result.confirmation as BookingConfirmation }
  } catch {
    return { ok: false, errors: { general: 'No pudimos confirmar el resultado. Consultá al negocio antes de volver a reservar.' } }
  }
}
