import { describe, expect, it } from 'vitest'
import { blocksOf, createBlock, ownerBook, tryCreateBlock, tryOwnerBook } from '../support/agenda.ts'
import { appointmentsOf, book, newBookableBusiness, slotsFor, tryBook } from '../support/booking.ts'
import { addDays, argentinaToday, nextDateOnWeekday } from '../support/dates.ts'
import { CHECK_VIOLATION, INSUFFICIENT_PRIVILEGE } from '../support/pg-errors.ts'
import { createService } from '../support/services.ts'
import { anonymousClient, newUserClient } from '../support/users.ts'
import { MONDAY } from '../support/working-hours.ts'

const monday = nextDateOnWeekday(MONDAY, 3)

// Límites de las reglas de negocio
const MAX_BLOCK_DAYS = 90
const MAX_REASON_LENGTH = 80
const MAX_OWNER_DAYS_AHEAD = 365
const MAX_NAME_LENGTH = 80
// Argentina está tres horas detrás de UTC todo el año
const ARGENTINA_UTC_OFFSET_HOURS = 3

const FULL_DAY = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']

describe('bloquear horarios', () => {
  it('un bloqueo saca los horarios que se le superponen y deja los que quedan pegados', async () => {
    const lucero = await newBookableBusiness()
    await createBlock(lucero, { startDate: monday, startTime: '10:00', endTime: '12:00' })

    // El turno de las 09:00 termina cuando empieza el bloqueo y el de las 12:00 empieza cuando termina
    expect(await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, monday)).toEqual([
      '09:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    ])
  })

  it('un bloqueo de varios días, como unas vacaciones, deja esos días sin horarios y los demás no', async () => {
    const lucero = await newBookableBusiness()
    const wednesday = addDays(monday, 2)
    await createBlock(lucero, { startDate: monday, startTime: '00:00', endDate: wednesday, endTime: '24:00' })
    const slots = (date: string) => slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, date)

    expect(await slots(monday)).toEqual([])
    expect(await slots(addDays(monday, 1))).toEqual([])
    expect(await slots(wednesday)).toEqual([])
    expect(await slots(addDays(monday, 3))).toEqual(FULL_DAY)
  })

  it('un bloqueo de todo el día no deja ningún horario', async () => {
    const lucero = await newBookableBusiness()
    await createBlock(lucero, { startDate: monday, startTime: '00:00', endTime: '24:00' })

    expect(await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, monday)).toEqual([])
  })

  it('el negocio ve su bloqueo en hora de Argentina, con el motivo sin los espacios de los costados', async () => {
    const lucero = await newBookableBusiness()
    await createBlock(lucero, { startDate: monday, startTime: '10:00', endTime: '12:00', reason: '  Trámite en el banco  ' })

    const [block] = await blocksOf(lucero)

    expect(block?.reason).toBe('Trámite en el banco')
    expect(new Date(block!.starts_at).toISOString()).toBe(`${monday}T${10 + ARGENTINA_UTC_OFFSET_HOURS}:00:00.000Z`)
    expect(new Date(block!.ends_at).toISOString()).toBe(`${monday}T${12 + ARGENTINA_UTC_OFFSET_HOURS}:00:00.000Z`)
  })

  it('un motivo vacío se guarda como sin motivo', async () => {
    const lucero = await newBookableBusiness()
    await createBlock(lucero, { startDate: monday, startTime: '10:00', endTime: '12:00', reason: '   ' })

    expect((await blocksOf(lucero))[0]?.reason).toBeNull()
  })

  it('borrar un bloqueo vuelve a ofrecer los horarios', async () => {
    const lucero = await newBookableBusiness()
    const blockId = await createBlock(lucero, { startDate: monday, startTime: '10:00', endTime: '12:00' })

    const removed = await lucero.owner.rpc('delete_time_block', { p_block_id: blockId })

    expect(removed.error).toBeNull()
    expect(await blocksOf(lucero)).toEqual([])
    expect(await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, monday)).toEqual(FULL_DAY)
  })

  it('no se puede reservar un horario bloqueado, aunque se arme el pedido a mano', async () => {
    const lucero = await newBookableBusiness()
    await createBlock(lucero, { startDate: monday, startTime: '10:00', endTime: '12:00' })

    const result = await tryBook({ slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })

    expect(result.error?.message).toBe('slot_unavailable')
    expect(await appointmentsOf(lucero)).toEqual([])
  })

  it('el bloqueo de un negocio no afecta los horarios de otro', async () => {
    const lucero = await newBookableBusiness()
    const norte = await newBookableBusiness()
    await createBlock(lucero, { startDate: monday, startTime: '00:00', endTime: '24:00' })

    expect(await slotsFor(anonymousClient(), norte.slug, norte.serviceId, monday)).toEqual(FULL_DAY)
  })
})

describe('qué bloqueos se aceptan', () => {
  it.each([
    ['que termina cuando empieza', { startDate: monday, startTime: '10:00', endTime: '10:00' }],
    ['que termina antes de empezar', { startDate: monday, startTime: '12:00', endTime: '10:00' }],
    ['con un motivo de 81 caracteres', { startDate: monday, startTime: '10:00', endTime: '12:00', reason: 'a'.repeat(MAX_REASON_LENGTH + 1) }],
    ['de más de 90 días', { startDate: monday, startTime: '00:00', endDate: addDays(monday, MAX_BLOCK_DAYS + 1), endTime: '00:00' }],
  ])('rechaza un bloqueo %s', async (_case, request) => {
    const lucero = await newBookableBusiness()

    const result = await tryCreateBlock(lucero.owner, lucero.id, request)

    expect(result.error?.code).toBe(CHECK_VIOLATION)
    expect(await blocksOf(lucero)).toEqual([])
  })

  it('acepta un bloqueo de justo 90 días y un motivo de 80 caracteres', async () => {
    const lucero = await newBookableBusiness()

    const result = await tryCreateBlock(lucero.owner, lucero.id, {
      startDate: monday,
      startTime: '00:00',
      endDate: addDays(monday, MAX_BLOCK_DAYS),
      endTime: '00:00',
      reason: 'a'.repeat(MAX_REASON_LENGTH),
    })

    expect(result.error).toBeNull()
  })

  it('rechaza un bloqueo que ya pasó', async () => {
    const lucero = await newBookableBusiness()
    const yesterday = addDays(argentinaToday(), -1)

    const result = await tryCreateBlock(lucero.owner, lucero.id, { startDate: yesterday, startTime: '10:00', endTime: '12:00' })

    expect(result.error?.message).toBe('in_the_past')
  })

  it('rechaza un bloqueo que se pisa con un turno reservado, y no lo crea', async () => {
    const lucero = await newBookableBusiness()
    await book({ slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })

    const result = await tryCreateBlock(lucero.owner, lucero.id, { startDate: monday, startTime: '09:30', endTime: '10:30' })

    expect(result.error?.message).toBe('overlaps_appointment')
    expect(await blocksOf(lucero)).toEqual([])
  })

  it('un turno cancelado no impide bloquear ese horario', async () => {
    const lucero = await newBookableBusiness()
    await book({ slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })
    const [appointment] = await appointmentsOf(lucero)
    await lucero.owner.rpc('cancel_appointment', { p_appointment_id: appointment!.id })

    const result = await tryCreateBlock(lucero.owner, lucero.id, { startDate: monday, startTime: '10:00', endTime: '11:00' })

    expect(result.error).toBeNull()
  })
})

describe('quién puede bloquear', () => {
  it('otro negocio no puede crear ni borrar bloqueos ajenos, y no los ve', async () => {
    const lucero = await newBookableBusiness()
    const intruder = await newUserClient()
    const blockId = await createBlock(lucero, { startDate: monday, startTime: '10:00', endTime: '12:00' })

    const create = await tryCreateBlock(intruder, lucero.id, { startDate: monday, startTime: '14:00', endTime: '15:00' })
    const remove = await intruder.rpc('delete_time_block', { p_block_id: blockId })
    const seen = await intruder.from('time_blocks').select('id')

    expect(create.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    expect(remove.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    expect(seen.data).toEqual([])
    expect(await blocksOf(lucero)).toHaveLength(1)
  })

  it('quien no inició sesión no puede bloquear, borrar ni ver bloqueos', async () => {
    const lucero = await newBookableBusiness()
    const blockId = await createBlock(lucero, { startDate: monday, startTime: '10:00', endTime: '12:00' })
    const visitor = anonymousClient()

    const create = await tryCreateBlock(visitor, lucero.id, { startDate: monday, startTime: '14:00', endTime: '15:00' })
    const remove = await visitor.rpc('delete_time_block', { p_block_id: blockId })
    const seen = await visitor.from('time_blocks').select('id')

    expect(create.error?.message).toMatch(/permission denied/)
    expect(remove.error?.message).toMatch(/permission denied/)
    // Sin sesión no hay ningún permiso de lectura sobre la tabla: es un rechazo, no una lista vacía
    expect(seen.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    expect(await blocksOf(lucero)).toHaveLength(1)
  })

  it('nadie escribe directo en la tabla de bloqueos, ni el negocio', async () => {
    const lucero = await newBookableBusiness()
    await createBlock(lucero, { startDate: monday, startTime: '10:00', endTime: '12:00' })

    const insert = await lucero.owner
      .from('time_blocks')
      .insert({ business_id: lucero.id, starts_at: `${monday}T20:00:00Z`, ends_at: `${monday}T21:00:00Z` })
    const update = await lucero.owner.from('time_blocks').update({ reason: 'Cambiado' }).eq('business_id', lucero.id).select('id')
    const removal = await lucero.owner.from('time_blocks').delete().eq('business_id', lucero.id).select('id')

    expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    expect(update.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    expect(removal.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    expect(await blocksOf(lucero)).toHaveLength(1)
  })

  it('borrar un bloqueo que no existe da error', async () => {
    const lucero = await newBookableBusiness()

    const result = await lucero.owner.rpc('delete_time_block', { p_block_id: '00000000-0000-4000-8000-000000000000' })

    expect(result.error?.message).toBe('block_not_found')
  })
})

describe('bloqueo y reserva a la vez', () => {
  it('si se bloquea y se reserva el mismo horario al mismo tiempo, no pueden quedar los dos', async () => {
    const lucero = await newBookableBusiness()

    for (const hour of FULL_DAY) {
      const endHour = `${String(Number(hour.slice(0, 2)) + 1).padStart(2, '0')}:00`
      const [block, booking] = await Promise.all([
        tryCreateBlock(lucero.owner, lucero.id, { startDate: monday, startTime: hour, endTime: endHour }),
        tryBook({ slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: hour }),
      ])

      expect(block.error === null && booking.error === null, `a las ${hour} quedaron el bloqueo y el turno`).toBe(false)
    }
  })
})

describe('bloqueo y turno cargado a mano a la vez', () => {
  it('si se bloquea y se carga a mano el mismo horario al mismo tiempo, no pueden quedar los dos', async () => {
    const lucero = await newBookableBusiness()

    for (const hour of FULL_DAY) {
      const endHour = `${String(Number(hour.slice(0, 2)) + 1).padStart(2, '0')}:00`
      const [block, appointment] = await Promise.all([
        tryCreateBlock(lucero.owner, lucero.id, { startDate: monday, startTime: hour, endTime: endHour }),
        tryOwnerBook(lucero.owner, lucero.id, { serviceId: lucero.serviceId, date: monday, time: hour }),
      ])

      expect(block.error === null && appointment.error === null, `a las ${hour} quedaron el bloqueo y el turno`).toBe(false)
    }
  })
})

describe('turno cargado a mano', () => {
  it('dura lo que dura el servicio que se eligió', async () => {
    const lucero = await newBookableBusiness({ serviceMinutes: 60 })
    const short = await createService(lucero.owner, lucero.id, 'Peinado', 30)
    await ownerBook(lucero, { serviceId: short.id, date: monday, time: '10:00' })

    const [appointment] = await appointmentsOf(lucero)

    expect(new Date(appointment!.ends_at).getTime() - new Date(appointment!.starts_at).getTime()).toBe(30 * 60_000)
  })

  it('sin celular no hay consentimiento, aunque el negocio marque los recordatorios', async () => {
    const lucero = await newBookableBusiness()
    await ownerBook(lucero, { serviceId: lucero.serviceId, date: monday, time: '10:00', phone: null, reminders: true })

    expect((await appointmentsOf(lucero))[0]?.consented_at).toBeNull()
  })

  it('el negocio carga un turno sin celular a una hora que no es de la grilla, y se ve como manual', async () => {
    const lucero = await newBookableBusiness()

    await ownerBook(lucero, { serviceId: lucero.serviceId, date: monday, time: '17:30' })
    const [appointment] = await appointmentsOf(lucero)

    expect(appointment).toMatchObject({
      client_name: 'Lorena Quiroga',
      client_phone: null,
      consented_at: null,
      service_name: 'Corte de pelo',
      status: 'pending',
      source: 'manual',
    })
    // Dura lo que el servicio, aunque se pase del cierre: el negocio decide
    expect(new Date(appointment!.starts_at).toISOString()).toBe(`${monday}T${17 + ARGENTINA_UTC_OFFSET_HOURS}:30:00.000Z`)
    expect(new Date(appointment!.ends_at).toISOString()).toBe(`${monday}T${18 + ARGENTINA_UTC_OFFSET_HOURS}:30:00.000Z`)
  })

  it('con celular, queda con el consentimiento solo si el negocio dice que el cliente aceptó los recordatorios', async () => {
    const lucero = await newBookableBusiness()
    await ownerBook(lucero, { serviceId: lucero.serviceId, date: monday, time: '09:00', phone: '5493445550181', reminders: true })
    await ownerBook(lucero, { serviceId: lucero.serviceId, date: monday, time: '10:00', phone: '5493445550182', reminders: false })

    const [accepted, declined] = await appointmentsOf(lucero)

    expect(accepted?.client_phone).toBe('5493445550181')
    expect(accepted?.consented_at).not.toBeNull()
    expect(declined?.client_phone).toBe('5493445550182')
    expect(declined?.consented_at).toBeNull()
  })

  it('una reserva hecha por el servidor desde la página pública queda como web y con el consentimiento', async () => {
    const lucero = await newBookableBusiness()
    await book({ slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })

    const [appointment] = await appointmentsOf(lucero)

    expect(appointment?.source).toBe('web')
    expect(appointment?.consented_at).not.toBeNull()
  })

  it('el horario cargado a mano deja de estar libre para la página pública', async () => {
    const lucero = await newBookableBusiness()
    await ownerBook(lucero, { serviceId: lucero.serviceId, date: monday, time: '10:00' })

    expect(await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, monday)).not.toContain('10:00')
  })

  it('no se pisa con otro turno ni con un bloqueo, pero sí con uno cancelado', async () => {
    const lucero = await newBookableBusiness()
    await book({ slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })
    await createBlock(lucero, { startDate: monday, startTime: '14:00', endTime: '15:00' })

    const overBooking = await tryOwnerBook(lucero.owner, lucero.id, { serviceId: lucero.serviceId, date: monday, time: '10:30' })
    const overBlock = await tryOwnerBook(lucero.owner, lucero.id, { serviceId: lucero.serviceId, date: monday, time: '14:30' })
    const [web] = await appointmentsOf(lucero)
    await lucero.owner.rpc('cancel_appointment', { p_appointment_id: web!.id })
    const overCancelled = await tryOwnerBook(lucero.owner, lucero.id, { serviceId: lucero.serviceId, date: monday, time: '10:00' })

    expect(overBooking.error?.message).toBe('slot_unavailable')
    expect(overBlock.error?.message).toBe('slot_unavailable')
    expect(overCancelled.error).toBeNull()
  })

  it('no acepta una fecha que ya pasó ni una a más de un año', async () => {
    const lucero = await newBookableBusiness()
    const today = argentinaToday()
    const book = (date: string) => tryOwnerBook(lucero.owner, lucero.id, { serviceId: lucero.serviceId, date, time: '10:00' })

    expect((await book(addDays(today, -1))).error?.message).toBe('in_the_past')
    expect((await book(addDays(today, MAX_OWNER_DAYS_AHEAD + 1))).error?.message).toBe('too_far')
    expect((await book(addDays(today, MAX_OWNER_DAYS_AHEAD))).error).toBeNull()
  })

  it('acepta un servicio pausado, pero no uno inexistente ni de otro negocio', async () => {
    const lucero = await newBookableBusiness()
    const norte = await newBookableBusiness()
    const paused = await createService(lucero.owner, lucero.id, 'Servicio pausado', 30)
    await lucero.owner.from('services').update({ active: false }).eq('id', paused.id)
    const request = { date: monday, time: '10:00' }

    const ofPaused = await tryOwnerBook(lucero.owner, lucero.id, { ...request, serviceId: paused.id })
    const unknown = await tryOwnerBook(lucero.owner, lucero.id, { ...request, time: '12:00', serviceId: '00000000-0000-4000-8000-000000000000' })
    const foreign = await tryOwnerBook(lucero.owner, lucero.id, { ...request, time: '14:00', serviceId: norte.serviceId })

    expect(ofPaused.error).toBeNull()
    expect(unknown.error?.message).toBe('service_not_found')
    expect(foreign.error?.message).toBe('service_not_found')
  })

  it('rechaza un nombre o un celular inválidos', async () => {
    const lucero = await newBookableBusiness()
    const request = { serviceId: lucero.serviceId, date: monday, time: '10:00' }

    const emptyName = await tryOwnerBook(lucero.owner, lucero.id, { ...request, name: '   ' })
    const longName = await tryOwnerBook(lucero.owner, lucero.id, { ...request, name: 'a'.repeat(MAX_NAME_LENGTH + 1) })
    const badPhone = await tryOwnerBook(lucero.owner, lucero.id, { ...request, phone: '123' })

    for (const result of [emptyName, longName, badPhone]) expect(result.error?.code).toBe(CHECK_VIOLATION)
    expect(await appointmentsOf(lucero)).toEqual([])
  })

  it('el tope de 3 turnos por celular no rige cuando carga el negocio', async () => {
    const lucero = await newBookableBusiness()
    for (const time of ['09:00', '10:00', '11:00', '12:00']) {
      await ownerBook(lucero, { serviceId: lucero.serviceId, date: monday, time, phone: '5493445550183' })
    }

    expect(await appointmentsOf(lucero)).toHaveLength(4)
  })

  it('otro negocio no puede cargar turnos en una agenda ajena', async () => {
    const lucero = await newBookableBusiness()
    const intruder = await newUserClient()

    const result = await tryOwnerBook(intruder, lucero.id, { serviceId: lucero.serviceId, date: monday, time: '10:00' })

    expect(result.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    expect(await appointmentsOf(lucero)).toEqual([])
  })

  it('quien no inició sesión no puede cargar turnos a mano', async () => {
    const lucero = await newBookableBusiness()

    const result = await tryOwnerBook(anonymousClient(), lucero.id, { serviceId: lucero.serviceId, date: monday, time: '10:00' })

    expect(result.error?.message).toMatch(/permission denied/)
    expect(await appointmentsOf(lucero)).toEqual([])
  })
})
