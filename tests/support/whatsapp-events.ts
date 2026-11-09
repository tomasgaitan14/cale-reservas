import { randomUUID } from 'node:crypto'
import { createBusiness } from './businesses.ts'
import { SAMPLE_CLIENT_NAME, SAMPLE_PHONE } from './booking.ts'
import { psql } from './psql.ts'
import { adminClient, newUserClient } from './users.ts'

// Todo lo que crean los tests lleva este prefijo en el id del mensaje, para limpiarlo al terminar sin tocar otros datos
export const WAMID_PREFIX = `wamid.TEST-${randomUUID().slice(0, 8)}-`
const MILLIS_PER_SECOND = 1000
const MILLIS_PER_DAY = 86_400_000
const FAR_FUTURE_DAYS = 400

export type DeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed'

let counter = 0
export const newWamid = (): string => `${WAMID_PREFIX}${++counter}`
const newDigits = (length: number): string => Array.from({ length }, () => Math.floor(Math.random() * 10)).join('')

export { psql }

export const runProcessor = (limit = 100): void => {
  psql(`call public.process_whatsapp_events(${limit})`)
}

export interface TestConnection {
  businessId: string
  connectionId: string
  wabaId: string
  phoneNumberId: string
}

const META_ID_LENGTH = 15

// Ids de Meta inventados y únicos para una conexión que todavía no existe
export const newMetaIds = (): Pick<TestConnection, 'wabaId' | 'phoneNumberId'> => ({ wabaId: newDigits(META_ID_LENGTH), phoneNumberId: newDigits(META_ID_LENGTH) })

// Un negocio con su conexión de WhatsApp. Se le pueden dar los ids: sirve para crear la conexión después de que llegaron sus avisos
export async function newConnection(ids: Pick<TestConnection, 'wabaId' | 'phoneNumberId'> = newMetaIds()): Promise<TestConnection> {
  const owner = await newUserClient()
  const business = await createBusiness(owner, 'Peluquería Lucero', 'lucero')
  const { wabaId, phoneNumberId } = ids
  const inserted = await adminClient()
    .from('whatsapp_connections')
    .insert({ business_id: business.id, waba_id: wabaId, phone_number_id: phoneNumberId, display_phone_number: '15556544823', credential_reference: 'vault:test', connection_status: 'connected' })
    .select('id')
    .single()
  if (inserted.error) throw inserted.error
  return { businessId: business.id, connectionId: inserted.data.id as string, wabaId, phoneNumberId }
}

interface DeliveryOptions {
  businessId: string
  connectionId: string | null
  wamid: string | null
  status?: string
}

// Un turno con su recordatorio. Cada turno cae en un día lejano distinto: dos turnos del mismo negocio no pueden superponerse
export async function newDelivery({ businessId, connectionId, wamid, status = 'sent' }: DeliveryOptions): Promise<string> {
  const startsAt = new Date(Date.now() + (FAR_FUTURE_DAYS + counter++) * MILLIS_PER_DAY)
  const appointment = await adminClient()
    .from('appointments')
    .insert({
      business_id: businessId,
      service_name: 'Corte de pelo',
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
      client_name: SAMPLE_CLIENT_NAME,
      client_phone: SAMPLE_PHONE,
    })
    .select('id')
    .single()
  if (appointment.error) throw appointment.error
  const delivery = await adminClient()
    .from('reminder_deliveries')
    .insert({
      appointment_id: appointment.data.id,
      business_id: businessId,
      connection_id: connectionId,
      scheduled_for: new Date(startsAt.getTime() - MILLIS_PER_DAY).toISOString(),
      reminder_hours: 24,
      status,
      meta_message_id: wamid,
    })
    .select('id')
    .single()
  if (delivery.error) throw delivery.error
  return delivery.data.id as string
}

interface StatusEventOptions {
  wamid: string
  status: DeliveryStatus
  connection: Pick<TestConnection, 'wabaId' | 'phoneNumberId'>
  // Segundos desde el epoch, como los manda Meta
  timestamp?: number
  errorCode?: string
}

const BASE_TIMESTAMP = 1_762_300_000

// Un estado con la forma de lo que arma la Edge Function a partir del aviso de Meta
export function statusItem({ wamid, status, connection, timestamp = BASE_TIMESTAMP, errorCode }: StatusEventOptions) {
  return {
    kind: 'status',
    waba_id: connection.wabaId,
    phone_number_id: connection.phoneNumberId,
    meta_message_id: wamid,
    status,
    error_code: errorCode ?? null,
    timestamp: String(timestamp),
    payload: {
      id: wamid,
      status,
      timestamp: String(timestamp),
      recipient_id: SAMPLE_PHONE,
      ...(errorCode ? { errors: [{ code: Number(errorCode), title: 'Message undeliverable' }] } : {}),
    },
  }
}

// Un mensaje entrante (el cliente escribió o tocó un botón)
export function messageItem(wamid: string, connection: Pick<TestConnection, 'wabaId' | 'phoneNumberId'>) {
  return {
    kind: 'message',
    waba_id: connection.wabaId,
    phone_number_id: connection.phoneNumberId,
    meta_message_id: wamid,
    status: null,
    error_code: null,
    timestamp: String(BASE_TIMESTAMP),
    payload: { from: SAMPLE_PHONE, id: wamid, timestamp: String(BASE_TIMESTAMP), type: 'text', text: { body: 'Hola' } },
  }
}

export const ingest = (items: unknown) => adminClient().rpc('ingest_whatsapp_events', { p_items: items })

export async function eventsOf(wamid: string) {
  const { data, error } = await adminClient().from('whatsapp_webhook_events').select('*').eq('meta_message_id', wamid).order('received_at')
  if (error) throw error
  return data as Record<string, any>[]
}

export async function singleEvent(wamid: string) {
  const events = await eventsOf(wamid)
  if (events.length !== 1) throw new Error(`Se esperaba un evento de ${wamid} y hay ${events.length}`)
  return events[0]!
}

export async function updateEvent(id: string, changes: Record<string, unknown>): Promise<void> {
  const { error } = await adminClient().from('whatsapp_webhook_events').update(changes).eq('id', id)
  if (error) throw error
}

export async function deliveryOf(id: string) {
  const { data, error } = await adminClient().from('reminder_deliveries').select('*').eq('id', id).single()
  if (error) throw error
  return data as Record<string, any>
}

export const iso = (epochSeconds: number): string => new Date(epochSeconds * MILLIS_PER_SECOND).toISOString()
export const daysAgo = (days: number): string => new Date(Date.now() - days * MILLIS_PER_DAY).toISOString()
export const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString()

// Deja el evento listo para el próximo intento, sin esperar el tiempo real de la espera
export const makeDue = (id: string) => updateEvent(id, { next_attempt_at: minutesAgo(1) })

export async function cleanUpTestEvents(): Promise<void> {
  const client = adminClient()
  await client.from('whatsapp_webhook_events').delete().like('meta_message_id', `${WAMID_PREFIX}%`)
  await client.from('reminder_deliveries').delete().like('meta_message_id', `${WAMID_PREFIX}%`)
}
