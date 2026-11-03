import type { SupabaseClient } from '@supabase/supabase-js'

// Crea un servicio como ese usuario y devuelve su id
export async function createService(client: SupabaseClient, businessId: string, name: string, durationMinutes: number): Promise<{ id: string }> {
  const { data, error } = await client
    .from('services')
    .insert({ business_id: businessId, name, duration_minutes: durationMinutes })
    .select('id')
    .single()
  if (error) throw error
  return { id: (data as { id: string }).id }
}
