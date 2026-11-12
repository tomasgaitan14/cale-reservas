import { supabase } from './supabase.ts'

export interface ClientAppointment {
  id: string
  service_name: string
  starts_at: string
  status: string
}

export interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
  updated_at: string
  appointments: ClientAppointment[]
}

export class ClientLoadError extends Error {
  constructor(detail: string) {
    super(`No se pudieron cargar los clientes: ${detail}`)
    this.name = 'ClientLoadError'
  }
}

export async function fetchClients(businessId: string): Promise<Client[]> {
  const [clients, appointments] = await Promise.all([
    supabase.from('clients').select('id, name, phone, email, notes, created_at, updated_at').eq('business_id', businessId).order('updated_at', { ascending: false }),
    supabase.from('appointments').select('id, client_id, service_name, starts_at, status').eq('business_id', businessId).not('client_id', 'is', null).order('starts_at', { ascending: false }),
  ])
  if (clients.error) throw new ClientLoadError(clients.error.message)
  if (appointments.error) throw new ClientLoadError(appointments.error.message)
  const history = new Map<string, ClientAppointment[]>()
  for (const appointment of appointments.data ?? []) {
    if (!appointment.client_id) continue
    const items = history.get(appointment.client_id) ?? []
    items.push({ id: appointment.id, service_name: appointment.service_name, starts_at: appointment.starts_at, status: appointment.status })
    history.set(appointment.client_id, items)
  }
  return (clients.data ?? []).map(client => ({ ...client, appointments: history.get(client.id) ?? [] })) as Client[]
}

export async function fetchClientDirectory(businessId: string): Promise<Pick<Client, 'id' | 'name' | 'phone' | 'email'>[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, phone, email')
    .eq('business_id', businessId)
    .order('name', { ascending: true })
    .limit(100)
  if (error) throw new ClientLoadError(error.message)
  return (data ?? []) as Pick<Client, 'id' | 'name' | 'phone' | 'email'>[]
}
