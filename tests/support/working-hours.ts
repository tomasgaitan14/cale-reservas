import type { SupabaseClient } from '@supabase/supabase-js'

export interface HoursRange {
  day_of_week: number
  start_time: string
  end_time: string
}

// Días de la semana como los guarda la base: 0 es domingo
export const MONDAY = 1
export const TUESDAY = 2
export const WEDNESDAY = 3
export const THURSDAY = 4
export const FRIDAY = 5
export const WEEKDAYS = [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY]

// Devuelve la respuesta tal cual, con su error si lo hay: para probar los rechazos
export function trySaveHours(client: SupabaseClient, businessId: string, ranges: unknown) {
  return client.rpc('replace_working_hours', { p_business_id: businessId, p_ranges: ranges })
}

export async function saveHours(client: SupabaseClient, businessId: string, ranges: HoursRange[]): Promise<void> {
  const { error } = await trySaveHours(client, businessId, ranges)
  if (error) throw error
}

// Lo que ve esa persona, ordenado por día y hora
export async function readHours(client: SupabaseClient): Promise<HoursRange[]> {
  const { data, error } = await client
    .from('working_hours')
    .select('day_of_week, start_time, end_time')
    .order('day_of_week')
    .order('start_time')
  if (error) throw error
  return data as HoursRange[]
}
