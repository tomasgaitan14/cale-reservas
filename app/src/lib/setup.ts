import { supabase } from './supabase.ts'

export interface SetupProgress {
  serviceCount: number
  hasHours: boolean
  // Turnos que todavía no terminaron y no están cancelados
  upcomingCount: number
}

export class SetupLoadError extends Error {
  constructor(detail: string) {
    super(`No se pudo leer el avance de la configuración: ${detail}`)
    this.name = 'SetupLoadError'
  }
}

async function countRows(table: 'services' | 'working_hours', businessId: string): Promise<number> {
  const { count, error } = table === 'services'
    ? await supabase.from('services').select('id', { count: 'exact', head: true }).eq('active', true).eq('business_id', businessId)
    : await supabase.from('working_hours').select('id', { count: 'exact', head: true }).eq('business_id', businessId)
  if (error) throw new SetupLoadError(error.message)
  return count ?? 0
}

async function countUpcomingAppointments(businessId: string, now: Date): Promise<number> {
  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true }).eq('business_id', businessId)
    .neq('status', 'cancelled')
    .gte('ends_at', now.toISOString())
  if (error) throw new SetupLoadError(error.message)
  return count ?? 0
}

// Qué falta cargar para que el negocio pueda recibir reservas, y cuántos turnos tiene por delante
export async function fetchSetupProgress(businessId: string, now: Date = new Date()): Promise<SetupProgress> {
  const [serviceCount, hoursCount, upcomingCount] = await Promise.all([
    countRows('services', businessId),
    countRows('working_hours', businessId),
    countUpcomingAppointments(businessId, now),
  ])
  return { serviceCount, hasHours: hoursCount > 0, upcomingCount }
}
