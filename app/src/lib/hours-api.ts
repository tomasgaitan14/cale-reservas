import { describeHoursError, fromRows, toRanges, type HoursRow, type WeekHours } from './hours.ts'
import { supabase } from './supabase.ts'

export class HoursLoadError extends Error {
  constructor(detail: string) {
    super(`No se pudo leer el horario: ${detail}`)
    this.name = 'HoursLoadError'
  }
}

export async function fetchHours(): Promise<WeekHours> {
  const { data, error } = await supabase.from('working_hours').select('day_of_week, start_time, end_time')
  if (error) throw new HoursLoadError(error.message)
  return fromRows(data as HoursRow[])
}

export type SaveHoursResult = { ok: true } | { ok: false; message: string }

// Guarda la semana completa de una vez: si algún tramo no es válido, no se guarda nada
export async function saveHours(businessId: string, week: WeekHours): Promise<SaveHoursResult> {
  const { error } = await supabase.rpc('replace_working_hours', { p_business_id: businessId, p_ranges: toRanges(week) })
  return error ? { ok: false, message: describeHoursError(error) } : { ok: true }
}
