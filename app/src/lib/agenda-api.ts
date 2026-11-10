import type { AgendaAppointment, AgendaBlock } from './agenda.ts'
import { describeAgendaError, type AgendaFormErrors } from './agenda-errors.ts'
import { addDays, dayStartInstant } from './dates.ts'
import { supabase } from './supabase.ts'

const APPOINTMENT_COLUMNS = 'id, client_name, client_phone, service_name, status, source, starts_at, ends_at, professional_id'
const BLOCK_COLUMNS = 'id, starts_at, ends_at, reason, professional_id'
const CANCELLED = 'cancelled'

export class AgendaLoadError extends Error {
  constructor(detail: string) {
    super(`No se pudo leer la agenda: ${detail}`)
    this.name = 'AgendaLoadError'
  }
}

export interface AgendaData {
  appointments: AgendaAppointment[]
  blocks: AgendaBlock[]
}

// Turnos (sin los cancelados) y bloqueos que tocan alguno de los días desde `firstDate` hasta `lastDate`, ambos incluidos
export async function fetchAgenda(businessId: string, firstDate: string, lastDate: string): Promise<AgendaData> {
  const from = dayStartInstant(firstDate)
  const to = dayStartInstant(addDays(lastDate, 1))

  const [appointments, blocks] = await Promise.all([
    supabase
      .from('appointments')
      .select(APPOINTMENT_COLUMNS)
      .eq('business_id', businessId)
      .neq('status', CANCELLED)
      .lt('starts_at', to)
      .gt('ends_at', from)
      .order('starts_at'),
    supabase.from('time_blocks').select(BLOCK_COLUMNS).eq('business_id', businessId).lt('starts_at', to).gt('ends_at', from).order('starts_at'),
  ])
  if (appointments.error) throw new AgendaLoadError(appointments.error.message)
  if (blocks.error) throw new AgendaLoadError(blocks.error.message)
  return { appointments: appointments.data as AgendaAppointment[], blocks: blocks.data as AgendaBlock[] }
}

export type AgendaResult = { ok: true } | { ok: false; errors: AgendaFormErrors }

function toResult(error: { code?: string; message?: string } | null): AgendaResult {
  return error ? { ok: false, errors: describeAgendaError(error) } : { ok: true }
}

export interface OwnerAppointmentInput {
  serviceId: string
  date: string
  time: string
  name: string
  // Ya normalizado, o null si el cliente no dejó celular
  phone: string | null
  // El cliente aceptó recibir recordatorios por WhatsApp
  reminders: boolean
}

export async function createOwnerAppointment(businessId: string, input: OwnerAppointmentInput): Promise<AgendaResult> {
  const { error } = await supabase.rpc('create_owner_booking', {
    p_business_id: businessId,
    p_service_id: input.serviceId,
    p_date: input.date,
    p_time: input.time,
    p_client_name: input.name,
    p_client_phone: input.phone ?? undefined,
    p_reminders: input.reminders,
  })
  return toResult(error)
}

export interface TimeBlockInput {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  reason: string
}

export async function createTimeBlock(businessId: string, input: TimeBlockInput): Promise<AgendaResult> {
  const { error } = await supabase.rpc('create_time_block', {
    p_business_id: businessId,
    p_start_date: input.startDate,
    p_start_time: input.startTime,
    p_end_date: input.endDate,
    p_end_time: input.endTime,
    p_reason: input.reason,
  })
  return toResult(error)
}

export async function deleteTimeBlock(blockId: string): Promise<AgendaResult> {
  const { error } = await supabase.rpc('delete_time_block', { p_block_id: blockId })
  return toResult(error)
}

export async function cancelAppointment(appointmentId: string): Promise<AgendaResult> {
  const { error } = await supabase.rpc('cancel_appointment', { p_appointment_id: appointmentId })
  return toResult(error)
}

// Conteos del inicio: cuentan inicios del día en Argentina, sin turnos cancelados.
export async function fetchDayCounts(businessId: string, today: string, professionalId?: string): Promise<{ today: number; tomorrow: number }> {
  async function count(date: string): Promise<number> {
    let query = supabase.from('appointments').select('id', { head: true, count: 'exact' })
      .eq('business_id', businessId).neq('status', CANCELLED)
      .gte('starts_at', dayStartInstant(date)).lt('starts_at', dayStartInstant(addDays(date, 1)))
    if (professionalId) query = query.eq('professional_id', professionalId)
    const { count, error } = await query
    if (error) throw new AgendaLoadError(error.message)
    return count ?? 0
  }
  const [todayCount, tomorrowCount] = await Promise.all([count(today), count(addDays(today, 1))])
  return { today: todayCount, tomorrow: tomorrowCount }
}
