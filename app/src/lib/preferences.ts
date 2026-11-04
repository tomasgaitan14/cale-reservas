import { supabase } from './supabase.ts'
import type { ReminderHours } from './onboarding.ts'
export interface Preferences {
  business_id: string
  reminder_hours: ReminderHours
  whatsapp_waitlist: boolean
  reminders_reviewed: boolean
  onboarding_completed: boolean
}
export function defaultPreferences(businessId: string): Preferences {
  return { business_id: businessId, reminder_hours: 24, whatsapp_waitlist: false, reminders_reviewed: false, onboarding_completed: false }
}
export class PreferencesError extends Error {
  constructor(detail: string) { super(detail); this.name = 'PreferencesError' }
}
export async function fetchPreferences(businessId: string): Promise<Preferences> {
  const { data, error } = await supabase.from('business_preferences').select('*').eq('business_id', businessId).maybeSingle()
  if (error) throw new PreferencesError('No pudimos leer tu configuración. Probá nuevamente.')
  return data ? { ...data, reminder_hours: data.reminder_hours as ReminderHours } : defaultPreferences(businessId)
}
export async function savePreferences(value: Preferences): Promise<void> {
  const { error } = await supabase.from('business_preferences').upsert(value, { onConflict: 'business_id' })
  if (error) throw new PreferencesError('No pudimos guardar tu configuración. Probá nuevamente.')
}
