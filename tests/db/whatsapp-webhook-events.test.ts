import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHECK_VIOLATION, INSUFFICIENT_PRIVILEGE } from '../support/pg-errors.ts'
import { localStack } from '../support/stack.ts'
import { adminClient, anonymousClient, newUserClient } from '../support/users.ts'
import {
  cleanUpTestEvents,
  daysAgo,
  deliveryOf,
  eventsOf,
  ingest,
  iso,
  makeDue,
  messageItem,
  minutesAgo,
  newConnection,
  newDelivery,
  newMetaIds,
  newWamid,
  psql,
  runProcessor,
  singleEvent,
  statusItem,
  updateEvent,
  type DeliveryStatus,
  type TestConnection,
} from '../support/whatsapp-events.ts'

const execFileAsync = promisify(execFile)
const NOT_NULL_VIOLATION = '23502'
const INVALID_PARAMETER_VALUE = '22023'
const MAX_ITEMS = 1000
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const BASE = 1_762_300_000

const at = (value: string | null): number => new Date(value ?? '').getTime()
const fromNow = (value: string | null): number => at(value) - Date.now()

async function scenario(deliveryStatus = 'pending') {
  const connection = await newConnection()
  const wamid = newWamid()
  const deliveryId = await newDelivery({ businessId: connection.businessId, connectionId: connection.connectionId, wamid, status: deliveryStatus })
  return { connection, wamid, deliveryId }
}

// Manda un estado y lo procesa, uno por uno: así se controla el orden en que "llegan"
async function receive(connection: TestConnection, wamid: string, status: DeliveryStatus, timestamp: number, errorCode?: string) {
  const result = await ingest([statusItem({ wamid, status, connection, timestamp, errorCode })])
  expect(result.error).toBeNull()
  runProcessor()
}

beforeAll(cleanUpTestEvents)
afterAll(cleanUpTestEvents)

describe('ingesta', () => {
  it('guarda los estados como pendientes y los mensajes entrantes sin procesar', async () => {
    const connection = await newConnection()
    const statusWamid = newWamid()
    const messageWamid = newWamid()
    const result = await ingest([statusItem({ wamid: statusWamid, status: 'delivered', connection }), messageItem(messageWamid, connection)])
    expect(result.error).toBeNull()
    expect(result.data).toEqual({ received: 2, inserted: 2, duplicates: 0 })

    const status = await singleEvent(statusWamid)
    expect(status).toMatchObject({ kind: 'status', process_status: 'pending', status_value: 'delivered', phone_number_id: connection.phoneNumberId, waba_id: connection.wabaId })
    expect(status.event_key).toBe(`status:${statusWamid}:delivered:${BASE}`)
    expect(at(status.event_at)).toBe(BASE * 1000)
    const message = await singleEvent(messageWamid)
    expect(message).toMatchObject({ kind: 'message', process_status: 'stored', attempts: 0 })
    expect(message.event_key).toBe(`msg:${messageWamid}`)
    expect(message.payload.text.body).toBe('Hola')
  })

  it('un lote repetido no guarda nada de nuevo', async () => {
    const connection = await newConnection()
    const wamid = newWamid()
    const items = [statusItem({ wamid, status: 'sent', connection }), messageItem(newWamid(), connection)]
    expect((await ingest(items)).data).toEqual({ received: 2, inserted: 2, duplicates: 0 })
    expect((await ingest(items)).data).toEqual({ received: 2, inserted: 0, duplicates: 2 })
    expect(await eventsOf(wamid)).toHaveLength(1)
  })

  it('el mismo aviso repetido dentro de un lote se guarda una sola vez', async () => {
    const connection = await newConnection()
    const wamid = newWamid()
    const item = statusItem({ wamid, status: 'read', connection })
    expect((await ingest([item, item, item])).data).toEqual({ received: 3, inserted: 1, duplicates: 2 })
  })

  it('no pierde avisos legítimos: el mismo estado con otro timestamp, o estados distintos, son eventos aparte', async () => {
    const connection = await newConnection()
    const wamid = newWamid()
    const result = await ingest([
      statusItem({ wamid, status: 'failed', connection, timestamp: BASE, errorCode: '131026' }),
      statusItem({ wamid, status: 'failed', connection, timestamp: BASE + 60, errorCode: '131026' }),
      statusItem({ wamid, status: 'sent', connection, timestamp: BASE }),
      statusItem({ wamid, status: 'delivered', connection, timestamp: BASE }),
    ])
    expect(result.data).toEqual({ received: 4, inserted: 4, duplicates: 0 })
    expect(await eventsOf(wamid)).toHaveLength(4)
  })

  it('un evento de otro tipo se guarda sin procesar y se deduplica por su contenido', async () => {
    const connection = await newConnection()
    const wamid = newWamid()
    const other = { kind: 'other', waba_id: connection.wabaId, phone_number_id: null, meta_message_id: wamid, status: null, error_code: null, timestamp: null, payload: { field: 'account_update', note: 'x' } }
    expect((await ingest([other, other])).data).toEqual({ received: 2, inserted: 1, duplicates: 1 })
    expect(await singleEvent(wamid)).toMatchObject({ kind: 'other', process_status: 'stored' })
    expect((await ingest([{ ...other, payload: { field: 'account_update', note: 'y' } }])).data).toMatchObject({ inserted: 1 })
  })

  it('un timestamp ilegible queda vacío y no tira el lote', async () => {
    const connection = await newConnection()
    const wamid = newWamid()
    const result = await ingest([{ ...statusItem({ wamid, status: 'sent', connection }), timestamp: 'no-es-un-numero' }])
    expect(result.error).toBeNull()
    expect((await singleEvent(wamid)).event_at).toBeNull()
  })

  it.each([
    ['algo que no es un arreglo', { kind: 'status' }, INVALID_PARAMETER_VALUE],
    ['null', null, INVALID_PARAMETER_VALUE],
    ['más ítems que el máximo', Array.from({ length: MAX_ITEMS + 1 }, () => ({})), INVALID_PARAMETER_VALUE],
  ])('rechaza %s', async (_label, items, code) => {
    const result = await ingest(items)
    expect(result.error?.code).toBe(code)
  })

  it.each([
    ['sin tipo', (item: Record<string, unknown>) => ({ ...item, kind: undefined }), NOT_NULL_VIOLATION],
    ['con un tipo desconocido', (item: Record<string, unknown>) => ({ ...item, kind: 'otro' }), CHECK_VIOLATION],
    ['un estado sin id de mensaje', (item: Record<string, unknown>) => ({ ...item, meta_message_id: null }), NOT_NULL_VIOLATION],
    ['un estado sin el estado', (item: Record<string, unknown>) => ({ ...item, status: null }), NOT_NULL_VIOLATION],
    ['un estado desconocido', (item: Record<string, unknown>) => ({ ...item, status: 'deleted' }), CHECK_VIOLATION],
    ['sin contenido', (item: Record<string, unknown>) => ({ ...item, payload: undefined }), NOT_NULL_VIOLATION],
  ])('rechaza un ítem %s y no guarda ni los demás del lote', async (_label, spoil, code) => {
    const connection = await newConnection()
    const goodWamid = newWamid()
    const bad = spoil(statusItem({ wamid: newWamid(), status: 'sent', connection }))
    const result = await ingest([statusItem({ wamid: goodWamid, status: 'sent', connection }), bad])
    expect(result.error?.code).toBe(code)
    expect(await eventsOf(goodWamid)).toHaveLength(0)
  })

  it('un mensaje sin id se rechaza', async () => {
    const connection = await newConnection()
    const result = await ingest([{ ...messageItem(newWamid(), connection), meta_message_id: null }])
    expect(result.error?.code).toBe(NOT_NULL_VIOLATION)
  })
})

describe('permisos', () => {
  const calls: [string, Record<string, unknown>][] = [
    ['ingest_whatsapp_events', { p_items: [] }],
    ['claim_whatsapp_events', { p_limit: 1, p_lease_seconds: 1 }],
    ['apply_whatsapp_status_event', { p_event_id: randomUUID(), p_lease_id: randomUUID() }],
    ['record_whatsapp_event_error', { p_event_id: randomUUID(), p_lease_id: randomUUID(), p_error_code: 'x' }],
    ['finish_whatsapp_event', { p_event_id: randomUUID(), p_status: 'processed', p_result_code: 'x' }],
    ['requeue_whatsapp_events', { p_phone_number_id: '1' }],
    ['purge_whatsapp_webhook_events', {}],
  ]

  it.each(calls)('%s: ni sin sesión ni con sesión de usuario', async (name, args) => {
    const anonymous = await anonymousClient().rpc(name, args)
    expect(anonymous.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    const user = await (await newUserClient()).rpc(name, args)
    expect(user.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
  })

  it('la tabla y la vista de salud no se leen con sesión de usuario ni sin sesión', async () => {
    const user = await newUserClient()
    for (const client of [anonymousClient(), user]) {
      expect((await client.from('whatsapp_webhook_events').select('id').limit(1)).error?.code).toBe(INSUFFICIENT_PRIVILEGE)
      expect((await client.from('whatsapp_webhook_events_health').select('kind').limit(1)).error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    }
  })

  it('un usuario no puede escribir en la tabla', async () => {
    const user = await newUserClient()
    const inserted = await user.from('whatsapp_webhook_events').insert({ event_key: `x:${randomUUID()}`, kind: 'other', payload: {} })
    expect(inserted.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
  })
})

describe('estados de entrega', () => {
  it('aplica enviado, entregado y leído en orden, con la hora de cada aviso', async () => {
    const { connection, wamid, deliveryId } = await scenario()
    await receive(connection, wamid, 'sent', BASE + 100)
    expect(await deliveryOf(deliveryId)).toMatchObject({ status: 'sent', delivered_at: null, read_at: null })
    await receive(connection, wamid, 'delivered', BASE + 200)
    await receive(connection, wamid, 'read', BASE + 300)

    const delivery = await deliveryOf(deliveryId)
    expect(delivery.status).toBe('read')
    expect(at(delivery.sent_at)).toBe((BASE + 100) * 1000)
    expect(at(delivery.delivered_at)).toBe((BASE + 200) * 1000)
    expect(at(delivery.read_at)).toBe((BASE + 300) * 1000)
    expect(delivery.last_error_code).toBeNull()
  })

  it('marca el evento como procesado, con su resultado y sin lease', async () => {
    const { connection, wamid } = await scenario()
    await receive(connection, wamid, 'sent', BASE)
    const event = await singleEvent(wamid)
    expect(event).toMatchObject({ process_status: 'processed', result_code: 'applied', attempts: 1, lease_id: null, lease_expires_at: null })
    expect(event.processed_at).not.toBeNull()
  })

  const ORDERS: DeliveryStatus[][] = [
    ['sent', 'delivered', 'read'],
    ['sent', 'read', 'delivered'],
    ['delivered', 'sent', 'read'],
    ['delivered', 'read', 'sent'],
    ['read', 'sent', 'delivered'],
    ['read', 'delivered', 'sent'],
  ]
  it.each(ORDERS)('si llegan desordenados (%s, %s, %s), el resultado es el mismo', async (...order) => {
    const { connection, wamid, deliveryId } = await scenario()
    const offsets = { sent: 100, delivered: 200, read: 300, failed: 0 }
    for (const status of order) await receive(connection, wamid, status, BASE + offsets[status])

    const delivery = await deliveryOf(deliveryId)
    expect(delivery.status).toBe('read')
    expect(at(delivery.sent_at)).toBe((BASE + 100) * 1000)
    expect(at(delivery.delivered_at)).toBe((BASE + 200) * 1000)
    expect(at(delivery.read_at)).toBe((BASE + 300) * 1000)
  })

  it('un estado repetido con otra hora conserva la más temprana', async () => {
    const { connection, wamid, deliveryId } = await scenario()
    await receive(connection, wamid, 'delivered', BASE + 500)
    await receive(connection, wamid, 'delivered', BASE + 200)
    await receive(connection, wamid, 'delivered', BASE + 900)
    expect(at((await deliveryOf(deliveryId)).delivered_at)).toBe((BASE + 200) * 1000)
  })

  it('solo toca la entrega de ese mensaje: las demás, aunque sean del mismo negocio, quedan igual', async () => {
    const target = await scenario()
    const sibling = await newDelivery({ businessId: target.connection.businessId, connectionId: target.connection.connectionId, wamid: newWamid(), status: 'pending' })
    const other = await scenario()
    await receive(target.connection, target.wamid, 'read', BASE + 300)
    expect((await deliveryOf(target.deliveryId)).status).toBe('read')
    for (const id of [sibling, other.deliveryId]) {
      expect(await deliveryOf(id)).toMatchObject({ status: 'pending', sent_at: null, delivered_at: null, read_at: null })
    }
  })

  it('un fallido marca la entrega con el código y la hora del error', async () => {
    const { connection, wamid, deliveryId } = await scenario()
    await receive(connection, wamid, 'sent', BASE + 100)
    await receive(connection, wamid, 'failed', BASE + 150, '131026')
    const delivery = await deliveryOf(deliveryId)
    expect(delivery).toMatchObject({ status: 'failed', last_error_code: '131026' })
    expect(at(delivery.last_error_at)).toBe((BASE + 150) * 1000)
  })

  it('un fallido que llega tarde no pisa una entrega ya entregada o leída', async () => {
    const delivered = await scenario()
    await receive(delivered.connection, delivered.wamid, 'delivered', BASE + 200)
    await receive(delivered.connection, delivered.wamid, 'failed', BASE + 100, '131026')
    expect(await deliveryOf(delivered.deliveryId)).toMatchObject({ status: 'delivered', last_error_code: null, last_error_at: null })

    const read = await scenario()
    await receive(read.connection, read.wamid, 'read', BASE + 300)
    await receive(read.connection, read.wamid, 'failed', BASE + 100, '131026')
    expect(await deliveryOf(read.deliveryId)).toMatchObject({ status: 'read', last_error_code: null })
  })

  it('un entregado posterior a un fallido gana, y un enviado tardío no lo revierte', async () => {
    const { connection, wamid, deliveryId } = await scenario()
    await receive(connection, wamid, 'failed', BASE + 100, '131026')
    await receive(connection, wamid, 'sent', BASE + 50)
    expect((await deliveryOf(deliveryId)).status).toBe('failed')
    await receive(connection, wamid, 'delivered', BASE + 200)
    expect((await deliveryOf(deliveryId)).status).toBe('delivered')
  })

  it('una entrega cancelada conserva su estado aunque llegue un aviso', async () => {
    const { connection, wamid, deliveryId } = await scenario('cancelled')
    await receive(connection, wamid, 'delivered', BASE + 200)
    const delivery = await deliveryOf(deliveryId)
    expect(delivery.status).toBe('cancelled')
    expect(at(delivery.delivered_at)).toBe((BASE + 200) * 1000)
  })

  it('con un timestamp ilegible usa la hora en que llegó el aviso', async () => {
    const { connection, wamid, deliveryId } = await scenario()
    await ingest([{ ...statusItem({ wamid, status: 'sent', connection }), timestamp: 'no-es-un-numero' }])
    runProcessor()
    const delivery = await deliveryOf(deliveryId)
    const event = await singleEvent(wamid)
    expect(at(delivery.sent_at)).toBe(at(event.received_at))
  })

  it('aunque un mensaje quedara como pendiente, el procesador de estados no lo toma', async () => {
    const connection = await newConnection()
    const wamid = newWamid()
    await ingest([messageItem(wamid, connection)])
    await updateEvent((await singleEvent(wamid)).id, { process_status: 'pending' })
    runProcessor()
    expect(await singleEvent(wamid)).toMatchObject({ kind: 'message', process_status: 'pending', attempts: 0, result_code: null })
  })

  it('los mensajes entrantes no se procesan: quedan guardados', async () => {
    const connection = await newConnection()
    const wamid = newWamid()
    await ingest([messageItem(wamid, connection)])
    runProcessor()
    expect(await singleEvent(wamid)).toMatchObject({ process_status: 'stored', attempts: 0, result_code: null })
  })
})

describe('aislamiento entre negocios', () => {
  async function untouched(deliveryId: string) {
    expect(await deliveryOf(deliveryId)).toMatchObject({ status: 'pending', sent_at: null, delivered_at: null, read_at: null, last_error_code: null })
  }
  const expectMismatch = async (wamid: string) => {
    const event = await singleEvent(wamid)
    expect(event).toMatchObject({ process_status: 'failed', result_code: 'ownership_mismatch', last_error_code: 'ownership_mismatch' })
  }

  it('un aviso de la conexión de otro negocio no modifica la entrega', async () => {
    const owner = await scenario()
    const other = await newConnection()
    await receive(other, owner.wamid, 'read', BASE)
    await untouched(owner.deliveryId)
    await expectMismatch(owner.wamid)
  })

  it('un aviso con otro WABA para el mismo número no modifica la entrega', async () => {
    const owner = await scenario()
    await receive({ ...owner.connection, wabaId: newMetaIds().wabaId }, owner.wamid, 'read', BASE)
    await untouched(owner.deliveryId)
    await expectMismatch(owner.wamid)
  })

  it('una entrega sin conexión asociada no se modifica', async () => {
    const connection = await newConnection()
    const wamid = newWamid()
    const deliveryId = await newDelivery({ businessId: connection.businessId, connectionId: null, wamid, status: 'pending' })
    await receive(connection, wamid, 'read', BASE)
    await untouched(deliveryId)
    await expectMismatch(wamid)
  })

  it('una entrega de otro negocio que apunta a esta conexión no se modifica', async () => {
    const connection = await newConnection()
    const otherBusiness = await newConnection()
    const wamid = newWamid()
    const deliveryId = await newDelivery({ businessId: otherBusiness.businessId, connectionId: connection.connectionId, wamid, status: 'pending' })
    await receive(connection, wamid, 'read', BASE)
    await untouched(deliveryId)
    await expectMismatch(wamid)
  })

  it('un evento con ownership_mismatch no se reabre solo ni con requeue', async () => {
    const owner = await scenario()
    const other = await newConnection()
    await receive(other, owner.wamid, 'read', BASE)
    const before = await singleEvent(owner.wamid)
    expect((await adminClient().rpc('requeue_whatsapp_events', { p_phone_number_id: other.phoneNumberId })).data).toBe(0)
    await makeDue(before.id)
    runProcessor()
    expect(await singleEvent(owner.wamid)).toMatchObject({ process_status: 'failed', attempts: 1 })
  })
})

describe('conexión que todavía no existe', () => {
  it('reintenta con espera creciente y, cumplidos los 7 días, lo vence sin borrarlo', async () => {
    const ids = newMetaIds()
    const wamid = newWamid()
    await ingest([statusItem({ wamid, status: 'sent', connection: ids })])

    runProcessor()
    let event = await singleEvent(wamid)
    expect(event).toMatchObject({ process_status: 'pending', result_code: 'waiting_connection', attempts: 1, lease_id: null })
    expect(fromNow(event.next_attempt_at)).toBeGreaterThan(4 * MINUTE)
    expect(fromNow(event.next_attempt_at)).toBeLessThan(6 * MINUTE)

    await makeDue(event.id)
    runProcessor()
    event = await singleEvent(wamid)
    expect(event.attempts).toBe(2)
    expect(fromNow(event.next_attempt_at)).toBeGreaterThan(9 * MINUTE)
    expect(fromNow(event.next_attempt_at)).toBeLessThan(11 * MINUTE)

    await updateEvent(event.id, { received_at: daysAgo(8), next_attempt_at: minutesAgo(1) })
    runProcessor()
    event = await singleEvent(wamid)
    expect(event).toMatchObject({ process_status: 'expired', result_code: 'connection_not_found' })
    expect(event.payload.id).toBe(wamid)
    expect(event.processed_at).not.toBeNull()
  })

  it('si la conexión aparece antes del vencimiento, el próximo reintento lo aplica', async () => {
    const ids = newMetaIds()
    const wamid = newWamid()
    await ingest([statusItem({ wamid, status: 'delivered', connection: ids, timestamp: BASE + 10 })])
    runProcessor()
    expect((await singleEvent(wamid)).result_code).toBe('waiting_connection')

    const connection = await newConnection(ids)
    const deliveryId = await newDelivery({ businessId: connection.businessId, connectionId: connection.connectionId, wamid, status: 'pending' })
    await makeDue((await singleEvent(wamid)).id)
    runProcessor()

    expect(await singleEvent(wamid)).toMatchObject({ process_status: 'processed', result_code: 'applied', attempts: 2 })
    expect(await deliveryOf(deliveryId)).toMatchObject({ status: 'delivered' })
  })

  it('un evento vencido se puede reabrir con requeue cuando la conexión ya existe', async () => {
    const ids = newMetaIds()
    const wamid = newWamid()
    await ingest([statusItem({ wamid, status: 'read', connection: ids, timestamp: BASE + 10 })])
    runProcessor()
    await updateEvent((await singleEvent(wamid)).id, { received_at: daysAgo(8), next_attempt_at: minutesAgo(1) })
    runProcessor()
    expect((await singleEvent(wamid)).process_status).toBe('expired')

    const connection = await newConnection(ids)
    const deliveryId = await newDelivery({ businessId: connection.businessId, connectionId: connection.connectionId, wamid, status: 'pending' })
    const requeued = await adminClient().rpc('requeue_whatsapp_events', { p_phone_number_id: ids.phoneNumberId })
    expect(requeued.data).toBe(1)
    expect(await singleEvent(wamid)).toMatchObject({ process_status: 'pending', attempts: 0, processed_at: null })
    runProcessor()

    expect(await singleEvent(wamid)).toMatchObject({ process_status: 'processed', result_code: 'applied' })
    expect((await deliveryOf(deliveryId)).status).toBe('read')
  })

  it('requeue solo reabre lo que esperaba esa conexión', async () => {
    const mine = newMetaIds()
    const theirs = newMetaIds()
    const insert = async (ids: typeof mine, fields: Record<string, unknown>) => {
      const wamid = newWamid()
      const { error } = await adminClient().from('whatsapp_webhook_events').insert({
        event_key: `status:${wamid}:sent:${BASE}`,
        kind: 'status',
        waba_id: ids.wabaId,
        phone_number_id: ids.phoneNumberId,
        meta_message_id: wamid,
        status_value: 'sent',
        payload: {},
        ...fields,
      })
      if (error) throw error
      return wamid
    }
    const waiting = await insert(mine, { process_status: 'pending', result_code: 'waiting_connection', attempts: 3, next_attempt_at: new Date(Date.now() + HOUR).toISOString() })
    const expired = await insert(mine, { process_status: 'expired', result_code: 'connection_not_found', processed_at: new Date().toISOString() })
    const mismatch = await insert(mine, { process_status: 'failed', result_code: 'ownership_mismatch', processed_at: new Date().toISOString() })
    const processed = await insert(mine, { process_status: 'processed', result_code: 'applied', processed_at: new Date().toISOString() })
    const waitingDelivery = await insert(mine, { process_status: 'pending', result_code: 'waiting_delivery', attempts: 2, next_attempt_at: new Date(Date.now() + HOUR).toISOString() })
    const other = await insert(theirs, { process_status: 'pending', result_code: 'waiting_connection' })

    expect((await adminClient().rpc('requeue_whatsapp_events', { p_phone_number_id: mine.phoneNumberId })).data).toBe(2)
    expect(await singleEvent(waiting)).toMatchObject({ process_status: 'pending', result_code: 'requeued', attempts: 0 })
    expect(await singleEvent(expired)).toMatchObject({ process_status: 'pending', result_code: 'requeued' })
    expect((await singleEvent(mismatch)).process_status).toBe('failed')
    expect((await singleEvent(processed)).process_status).toBe('processed')
    expect(await singleEvent(waitingDelivery)).toMatchObject({ result_code: 'waiting_delivery', attempts: 2 })
    expect(await singleEvent(other)).toMatchObject({ result_code: 'waiting_connection' })
  })

  it('con muchos intentos la espera se topa en 6 horas y no desborda', async () => {
    const wamid = newWamid()
    await ingest([statusItem({ wamid, status: 'sent', connection: newMetaIds() })])
    await updateEvent((await singleEvent(wamid)).id, { attempts: 60 })
    runProcessor()
    const event = await singleEvent(wamid)
    expect(event).toMatchObject({ process_status: 'pending', attempts: 61 })
    expect(fromNow(event.next_attempt_at)).toBeGreaterThan(6 * HOUR - 2 * MINUTE)
    expect(fromNow(event.next_attempt_at)).toBeLessThanOrEqual(6 * HOUR)
  })
})

describe('mensaje que todavía no tiene entrega', () => {
  it('espera a que quien envió guarde el id y entonces lo aplica', async () => {
    const connection = await newConnection()
    const wamid = newWamid()
    await ingest([statusItem({ wamid, status: 'sent', connection, timestamp: BASE + 5 })])
    runProcessor()
    let event = await singleEvent(wamid)
    expect(event).toMatchObject({ process_status: 'pending', result_code: 'waiting_delivery' })
    expect(fromNow(event.next_attempt_at)).toBeGreaterThan(20_000)
    expect(fromNow(event.next_attempt_at)).toBeLessThan(40_000)

    const deliveryId = await newDelivery({ businessId: connection.businessId, connectionId: connection.connectionId, wamid, status: 'pending' })
    await makeDue(event.id)
    runProcessor()
    event = await singleEvent(wamid)
    expect(event).toMatchObject({ process_status: 'processed', result_code: 'applied' })
    expect(at((await deliveryOf(deliveryId)).sent_at)).toBe((BASE + 5) * 1000)
  })

  it('pasadas 2 horas sin entrega queda ignorado (típico de un envío de prueba)', async () => {
    const connection = await newConnection()
    const wamid = newWamid()
    await ingest([statusItem({ wamid, status: 'sent', connection })])
    runProcessor()
    await updateEvent((await singleEvent(wamid)).id, { received_at: minutesAgo(121), next_attempt_at: minutesAgo(1) })
    runProcessor()
    expect(await singleEvent(wamid)).toMatchObject({ process_status: 'ignored', result_code: 'no_delivery_for_message' })
  })
})

describe('recuperación de eventos en processing', () => {
  async function pendingEvent() {
    const { connection, wamid, deliveryId } = await scenario()
    await ingest([statusItem({ wamid, status: 'delivered', connection, timestamp: BASE + 7 })])
    return { event: await singleEvent(wamid), wamid, deliveryId }
  }

  it('un evento processing con el lease vencido lo retoma el siguiente procesador', async () => {
    const { event, wamid, deliveryId } = await pendingEvent()
    await updateEvent(event.id, { process_status: 'processing', lease_id: randomUUID(), lease_expires_at: minutesAgo(10), attempts: 1 })
    runProcessor()
    expect(await singleEvent(wamid)).toMatchObject({ process_status: 'processed', result_code: 'applied', attempts: 2, lease_id: null })
    expect((await deliveryOf(deliveryId)).status).toBe('delivered')
  })

  it('un lease que todavía no venció no se toca', async () => {
    const { event, wamid, deliveryId } = await pendingEvent()
    const lease = randomUUID()
    await updateEvent(event.id, { process_status: 'processing', lease_id: lease, lease_expires_at: new Date(Date.now() + 10 * MINUTE).toISOString(), attempts: 1 })
    runProcessor()
    expect(await singleEvent(wamid)).toMatchObject({ process_status: 'processing', lease_id: lease, attempts: 1 })
    expect((await deliveryOf(deliveryId)).status).toBe('pending')
  })

  it('quien perdió el lease no aplica nada', async () => {
    const { event, wamid, deliveryId } = await pendingEvent()
    const stale = await adminClient().rpc('apply_whatsapp_status_event', { p_event_id: event.id, p_lease_id: randomUUID() })
    expect(stale.data).toBe('lease_lost')
    expect(await singleEvent(wamid)).toMatchObject({ process_status: 'pending', attempts: 0 })
    expect((await deliveryOf(deliveryId)).status).toBe('pending')

    await updateEvent(event.id, { process_status: 'processing', lease_id: randomUUID(), lease_expires_at: minutesAgo(10) })
    const claimed = await adminClient().rpc('claim_whatsapp_events', { p_limit: 500, p_lease_seconds: 300 })
    expect(claimed.error).toBeNull()
    const mine = (claimed.data as { id: string; lease_id: string }[]).find(row => row.id === event.id)
    expect(mine).toBeDefined()
    const oldOwner = await adminClient().rpc('apply_whatsapp_status_event', { p_event_id: event.id, p_lease_id: randomUUID() })
    expect(oldOwner.data).toBe('lease_lost')
    expect((await deliveryOf(deliveryId)).status).toBe('pending')
    const newOwner = await adminClient().rpc('apply_whatsapp_status_event', { p_event_id: event.id, p_lease_id: mine!.lease_id })
    expect(newOwner.data).toBe('processed')
  })

  describe('un evento que falla siempre', () => {
    it('se reintenta con espera creciente y, a los 8 intentos, queda fallido con el error real', async () => {
      const { connection, wamid, deliveryId } = await scenario()
      await ingest([statusItem({ wamid, status: 'sent', connection })])
      const trigger = `boom_${randomUUID().slice(0, 8)}`
      psql(`create function public.${trigger}() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$`)
      psql(`create trigger ${trigger} before update on public.reminder_deliveries for each row when (new.meta_message_id = '${wamid}') execute function public.${trigger}()`)
      try {
        runProcessor()
        let event = await singleEvent(wamid)
        expect(event).toMatchObject({ process_status: 'pending', result_code: 'retrying', attempts: 1, last_error_code: 'P0001', lease_id: null })
        expect(fromNow(event.next_attempt_at)).toBeGreaterThan(0)

        for (let attempt = 2; attempt <= 8; attempt += 1) {
          await makeDue(event.id)
          runProcessor()
          event = await singleEvent(wamid)
          expect(event.attempts).toBe(attempt)
        }
        expect(event).toMatchObject({ process_status: 'failed', result_code: 'processing_error', last_error_code: 'P0001' })
        expect(event.processed_at).not.toBeNull()
        expect((await deliveryOf(deliveryId)).status).toBe('pending')

        await makeDue(event.id)
        runProcessor()
        expect((await singleEvent(wamid)).attempts).toBe(8)
      } finally {
        psql(`drop trigger if exists ${trigger} on public.reminder_deliveries`)
        psql(`drop function if exists public.${trigger}()`)
      }
    })

    it('uno que falla no impide que se procesen los demás del lote', async () => {
      const bad = await scenario()
      const good = await scenario()
      await ingest([statusItem({ wamid: bad.wamid, status: 'sent', connection: bad.connection }), statusItem({ wamid: good.wamid, status: 'sent', connection: good.connection })])
      const trigger = `boom_${randomUUID().slice(0, 8)}`
      psql(`create function public.${trigger}() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$`)
      psql(`create trigger ${trigger} before update on public.reminder_deliveries for each row when (new.meta_message_id = '${bad.wamid}') execute function public.${trigger}()`)
      try {
        runProcessor()
      } finally {
        psql(`drop trigger if exists ${trigger} on public.reminder_deliveries`)
        psql(`drop function if exists public.${trigger}()`)
      }
      expect((await singleEvent(bad.wamid)).result_code).toBe('retrying')
      expect((await singleEvent(good.wamid)).process_status).toBe('processed')
      expect((await deliveryOf(good.deliveryId)).status).toBe('sent')
    })
  })
})

describe('retención', () => {
  async function insertEvent(fields: Record<string, unknown>): Promise<string> {
    const wamid = newWamid()
    const { error } = await adminClient().from('whatsapp_webhook_events').insert({
      event_key: `purge:${wamid}`,
      kind: 'status',
      phone_number_id: '1',
      meta_message_id: wamid,
      status_value: 'sent',
      payload: {},
      ...fields,
    })
    if (error) throw error
    return wamid
  }
  const exists = async (wamid: string) => (await eventsOf(wamid)).length === 1

  it('borra procesados e ignorados a los 30 días, fallidos y vencidos a los 90, y mensajes sin procesar a los 90', async () => {
    const processedOld = await insertEvent({ process_status: 'processed', processed_at: daysAgo(31) })
    const processedNew = await insertEvent({ process_status: 'processed', processed_at: daysAgo(29) })
    const ignoredOld = await insertEvent({ process_status: 'ignored', processed_at: daysAgo(31) })
    const ignoredNew = await insertEvent({ process_status: 'ignored', processed_at: daysAgo(29) })
    const failedOld = await insertEvent({ process_status: 'failed', processed_at: daysAgo(91) })
    const failedNew = await insertEvent({ process_status: 'failed', processed_at: daysAgo(89) })
    const failedAt60 = await insertEvent({ process_status: 'failed', processed_at: daysAgo(60) })
    const expiredOld = await insertEvent({ process_status: 'expired', processed_at: daysAgo(91) })
    const expiredNew = await insertEvent({ process_status: 'expired', processed_at: daysAgo(89) })
    const storedOld = await insertEvent({ kind: 'message', status_value: null, process_status: 'stored', received_at: daysAgo(91) })
    const storedNew = await insertEvent({ kind: 'message', status_value: null, process_status: 'stored', received_at: daysAgo(89) })
    const pendingAncient = await insertEvent({ process_status: 'pending', received_at: daysAgo(200) })

    const result = await adminClient().rpc('purge_whatsapp_webhook_events')
    expect(result.error).toBeNull()
    expect(result.data.processed).toBeGreaterThanOrEqual(1)
    expect(result.data.ignored).toBeGreaterThanOrEqual(1)
    expect(result.data.failed).toBeGreaterThanOrEqual(1)
    expect(result.data.expired).toBeGreaterThanOrEqual(1)
    expect(result.data.stored).toBeGreaterThanOrEqual(1)

    for (const gone of [processedOld, ignoredOld, failedOld, expiredOld, storedOld]) expect(await exists(gone)).toBe(false)
    for (const kept of [processedNew, ignoredNew, failedNew, failedAt60, expiredNew, storedNew, pendingAncient]) expect(await exists(kept)).toBe(true)
  })

  it('un evento fallido con 60 días sigue disponible para revisarlo (no se borra a los 30)', async () => {
    const wamid = await insertEvent({ process_status: 'failed', result_code: 'ownership_mismatch', processed_at: daysAgo(60) })
    await adminClient().rpc('purge_whatsapp_webhook_events')
    expect(await eventsOf(wamid)).toHaveLength(1)
  })
})

describe('salud y orden de estados', () => {
  it('la vista cuenta los eventos por tipo, estado y motivo sin mostrar su contenido', async () => {
    const connection = await newConnection()
    await ingest([messageItem(newWamid(), connection)])
    const { data, error } = await adminClient().from('whatsapp_webhook_events_health').select('*').eq('kind', 'message').eq('process_status', 'stored')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(Object.keys(data![0]!).sort()).toEqual(['events', 'kind', 'oldest_received_at', 'process_status', 'result_code'])
    expect(data![0]!.events).toBeGreaterThanOrEqual(1)
  })

  it('el orden de los estados sube con el avance y no incluye cancelled', () => {
    const rank = (status: string) => psql(`select coalesce(public.whatsapp_delivery_rank('${status}')::text, 'null')`)
    expect(['pending', 'processing', 'sent', 'failed', 'delivered', 'read', 'cancelled'].map(rank)).toEqual(['0', '0', '1', '2', '3', '4', 'null'])
  })
})

describe('concurrencia', () => {
  it('un procesador que tiene eventos tomados sin confirmar no los comparte con otro que toma a la vez', async () => {
    const connection = await newConnection()
    const wamids = Array.from({ length: 12 }, () => newWamid())
    await ingest(wamids.map(wamid => statusItem({ wamid, status: 'sent', connection })))

    // El primero toma los eventos y deja la transacción abierta unos segundos; el segundo toma mientras tanto
    const holdSeconds = 4
    const first = execFileAsync(
      'psql',
      [localStack().dbUrl, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', 'begin', '-c', 'select id from public.claim_whatsapp_events(500, 300)', '-c', `select pg_sleep(${holdSeconds})`, '-c', 'commit'],
      { encoding: 'utf8' },
    )
    await new Promise(resolve => setTimeout(resolve, 1500))
    const second = await adminClient().rpc('claim_whatsapp_events', { p_limit: 500, p_lease_seconds: 300 })
    expect(second.error).toBeNull()
    const firstIds = (await first).stdout.split('\n').filter(line => /^[0-9a-f-]{36}$/.test(line))
    expect(firstIds.length).toBeGreaterThan(0)
    const secondIds = (second.data as { id: string }[]).map(row => row.id)

    expect(firstIds.filter(id => secondIds.includes(id))).toEqual([])
    const mine = (await Promise.all(wamids.map(singleEvent))).map(event => event.id)
    expect(mine.every(id => firstIds.includes(id) || secondIds.includes(id))).toBe(true)
    expect(mine.some(id => firstIds.includes(id))).toBe(true)
  }, 30_000)
})
