import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookableBusiness } from './booking.ts'

export interface BlockRequest {
  startDate: string
  startTime: string
  // Si no se indica, el bloqueo termina el mismo día
  endDate?: string
  endTime: string
  reason?: string | null
}

// Devuelve la respuesta tal cual, con su error si lo hay: para probar los rechazos
export function tryCreateBlock(client: SupabaseClient, businessId: string, request: BlockRequest) {
  return client.rpc('create_time_block', {
    p_business_id: businessId,
    p_start_date: request.startDate,
    p_start_time: request.startTime,
    p_end_date: request.endDate ?? request.startDate,
    p_end_time: request.endTime,
    p_reason: request.reason ?? null,
  })
}

// Crea el bloqueo y devuelve su id
export async function createBlock(business: BookableBusiness, request: BlockRequest): Promise<string> {
  const { data, error } = await tryCreateBlock(business.owner, business.id, request)
  if (error) throw error
  return data as string
}

export interface OwnerBookingRequest {
  serviceId: string
  date: string
  time: string
  name?: string
  phone?: string | null
  reminders?: boolean
}

const MANUAL_CLIENT_NAME = 'Lorena Quiroga'

export function tryOwnerBook(client: SupabaseClient, businessId: string, request: OwnerBookingRequest) {
  return client.rpc('create_owner_booking', {
    p_business_id: businessId,
    p_service_id: request.serviceId,
    p_date: request.date,
    p_time: request.time,
    p_client_name: request.name ?? MANUAL_CLIENT_NAME,
    p_client_phone: request.phone ?? null,
    p_reminders: request.reminders ?? false,
  })
}

export async function ownerBook(business: BookableBusiness, request: OwnerBookingRequest): Promise<string> {
  const { data, error } = await tryOwnerBook(business.owner, business.id, request)
  if (error) throw error
  return data as string
}

export interface StoredBlock {
  id: string
  starts_at: string
  ends_at: string
  reason: string | null
}

// Lo que ve el negocio de sus bloqueos
export async function blocksOf(business: BookableBusiness): Promise<StoredBlock[]> {
  const { data, error } = await business.owner.from('time_blocks').select('id, starts_at, ends_at, reason').order('starts_at')
  if (error) throw error
  return data as StoredBlock[]
}
