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

async function countRows(table: 'services' | 'working_hours'): Promise<number> {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true })
  if (error) throw new SetupLoadError(error.message)
  return count ?? 0
}

async function countUpcomingAppointments(now: Date): Promise<number> {
  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'cancelled')
    .gte('ends_at', now.toISOString())
  if (error) throw new SetupLoadError(error.message)
  return count ?? 0
}

// Qué falta cargar para que el negocio pueda recibir reservas, y cuántos turnos tiene por delante
export async function fetchSetupProgress(now: Date = new Date()): Promise<SetupProgress> {
  const [serviceCount, hoursCount, upcomingCount] = await Promise.all([
    countRows('services'),
    countRows('working_hours'),
    countUpcomingAppointments(now),
  ])
  return { serviceCount, hasHours: hoursCount > 0, upcomingCount }
}
