import { supabase } from './supabase.ts'

export interface Appointment {
  id: string
  client_name: string
  client_phone: string
  service_name: string
  status: string
  // Instantes en UTC; se pasan a hora de Argentina con localParts
  starts_at: string
  ends_at: string
}

const APPOINTMENT_COLUMNS = 'id, client_name, client_phone, service_name, status, starts_at, ends_at'
const CANCELLED = 'cancelled'

export class AppointmentLoadError extends Error {
  constructor(detail: string) {
    super(`No se pudieron leer los turnos: ${detail}`)
    this.name = 'AppointmentLoadError'
  }
}

// Turnos que todavía no terminaron y no están cancelados, del más próximo al más lejano
export async function fetchUpcomingAppointments(now: Date = new Date()): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .neq('status', CANCELLED)
    .gte('ends_at', now.toISOString())
    .order('starts_at')
  if (error) throw new AppointmentLoadError(error.message)
  return data as Appointment[]
}

export type CancelResult = { ok: true } | { ok: false; message: string }

const CANCEL_FAILED = 'No pudimos cancelar el turno. Probá de nuevo en un momento.'

export async function cancelAppointment(id: string): Promise<CancelResult> {
  const { error } = await supabase.rpc('cancel_appointment', { p_appointment_id: id })
  return error ? { ok: false, message: CANCEL_FAILED } : { ok: true }
}
