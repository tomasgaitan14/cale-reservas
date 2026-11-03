import { describe, expect, it } from 'vitest'
import { appointmentsOf, book, newBookableBusiness, SAMPLE_CLIENT_NAME, SAMPLE_PHONE, slotsFor, tryBook, type BookableBusiness } from '../support/booking.ts'
import { addDays, argentinaToday, nextDateOnWeekday } from '../support/dates.ts'
import { CHECK_VIOLATION, INSUFFICIENT_PRIVILEGE } from '../support/pg-errors.ts'
import { createService } from '../support/services.ts'
import { anonymousClient, newUserClient } from '../support/users.ts'
import { MONDAY } from '../support/working-hours.ts'

const monday = nextDateOnWeekday(MONDAY, 3)

// Reglas de reserva
const MAX_FUTURE_BOOKINGS_PER_PHONE = 3
const MIN_PHONE_DIGITS = 10
const MAX_PHONE_DIGITS = 15
const MAX_NAME_LENGTH = 80
const MAX_DAYS_AHEAD = 30
// Argentina está tres horas detrás de UTC todo el año
const ARGENTINA_UTC_OFFSET_HOURS = 3

describe('reservar un turno', () => {
  it('cualquiera, sin sesión, reserva un horario libre y recibe la confirmación', async () => {
    const lucero = await newBookableBusiness()

    const booked = await tryBook(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })

    expect(booked.error).toBeNull()
    expect(booked.data).toEqual({ business_name: 'Peluquería Lucero', service_name: 'Corte de pelo', date: monday, time: '10:00' })
  })

  it('el negocio ve el turno con el nombre y el celular, pendiente y en hora de Argentina', async () => {
    const lucero = await newBookableBusiness()
    await book(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })

    const [appointment] = await appointmentsOf(lucero)

    expect(appointment).toMatchObject({ client_name: SAMPLE_CLIENT_NAME, client_phone: SAMPLE_PHONE, service_name: 'Corte de pelo', status: 'pending' })
    // 10:00 en Argentina son las 13:00 UTC, y el servicio dura una hora
    expect(new Date(appointment!.starts_at).toISOString()).toBe(`${monday}T${10 + ARGENTINA_UTC_OFFSET_HOURS}:00:00.000Z`)
    expect(new Date(appointment!.ends_at).toISOString()).toBe(`${monday}T${11 + ARGENTINA_UTC_OFFSET_HOURS}:00:00.000Z`)
  })

  it('el turno dura lo que dura el servicio que se eligió', async () => {
    const lucero = await newBookableBusiness({ serviceMinutes: 60 })
    const short = await createService(lucero.owner, lucero.id, 'Peinado', 30)
    await book(anonymousClient(), { slug: lucero.slug, serviceId: short.id, date: monday, time: '10:00' })

    const [appointment] = await appointmentsOf(lucero)

    expect(appointment?.service_name).toBe('Peinado')
    expect(new Date(appointment!.ends_at).getTime() - new Date(appointment!.starts_at).getTime()).toBe(30 * 60_000)
  })

  it('el horario reservado deja de estar libre, y también los que se le superponen, aunque sean de otro servicio', async () => {
    const lucero = await newBookableBusiness({ serviceMinutes: 60 })
    const short = await createService(lucero.owner, lucero.id, 'Peinado', 30)
    await book(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })

    const hourly = await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, monday)
    const halfHourly = await slotsFor(anonymousClient(), lucero.slug, short.id, monday)

    expect(hourly).not.toContain('10:00')
    expect(hourly).toContain('09:00')
    expect(hourly).toContain('11:00')
    // Un turno de media hora a las 09:30 termina justo cuando empieza el de las 10:00; el de las 10:00 y el de las 10:30 se pisan con él
    expect(halfHourly).toContain('09:30')
    expect(halfHourly).not.toContain('10:00')
    expect(halfHourly).not.toContain('10:30')
    expect(halfHourly).toContain('11:00')
  })

  it('una reserva en un negocio no ocupa los horarios de otro', async () => {
    const lucero = await newBookableBusiness()
    const norte = await newBookableBusiness()
    await book(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })

    expect(await slotsFor(anonymousClient(), norte.slug, norte.serviceId, monday)).toContain('10:00')
  })

  it('rechaza reservar un horario que ya está ocupado', async () => {
    const lucero = await newBookableBusiness()
    await book(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })

    const second = await tryBook(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00', phone: '5493445550143' })

    expect(second.error?.message).toBe('slot_unavailable')
    expect(await appointmentsOf(lucero)).toHaveLength(1)
  })

  it('si dos personas reservan el mismo horario a la vez, solo una se queda con el turno', async () => {
    const lucero = await newBookableBusiness()
    const request = { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '14:00' }

    const results = await Promise.all([
      tryBook(anonymousClient(), { ...request, phone: '5493445550151' }),
      tryBook(anonymousClient(), { ...request, phone: '5493445550152' }),
      tryBook(anonymousClient(), { ...request, phone: '5493445550153' }),
    ])

    expect(results.filter(result => result.error === null)).toHaveLength(1)
    expect(results.filter(result => result.error?.message === 'slot_unavailable')).toHaveLength(2)
    expect(await appointmentsOf(lucero)).toHaveLength(1)
  })
})

describe('qué se puede reservar', () => {
  const rejected = async (overrides: { date?: string; time?: string; serviceId?: string }) => {
    const lucero = await newBookableBusiness()
    const result = await tryBook(anonymousClient(), {
      slug: lucero.slug,
      serviceId: overrides.serviceId ?? lucero.serviceId,
      date: overrides.date ?? monday,
      time: overrides.time ?? '10:00',
    })
    return { result, lucero }
  }

  it.each([
    ['una hora que no es un turno de la grilla', { time: '10:30' }],
    ['una hora antes de que abra', { time: '07:00' }],
    ['la hora de cierre', { time: '18:00' }],
    ['un turno que se pasa del cierre', { time: '17:30' }],
    ['un día que el negocio no atiende', { date: nextDateOnWeekday(0, 3) }],
    ['un día pasado', { date: addDays(argentinaToday(), -1) }],
    ['un día a más de 30 días', { date: addDays(argentinaToday(), MAX_DAYS_AHEAD + 1) }],
  ])('rechaza %s y no guarda nada', async (_case, overrides) => {
    const { result, lucero } = await rejected(overrides)

    expect(result.error?.message).toBe('slot_unavailable')
    expect(await appointmentsOf(lucero)).toEqual([])
  })

  it('rechaza un servicio pausado, uno inexistente y uno de otro negocio', async () => {
    const lucero = await newBookableBusiness()
    const norte = await newBookableBusiness()
    await lucero.owner.from('services').update({ active: false }).eq('id', lucero.serviceId)
    const request = { slug: lucero.slug, date: monday, time: '10:00' }

    const paused = await tryBook(anonymousClient(), { ...request, serviceId: lucero.serviceId })
    const unknown = await tryBook(anonymousClient(), { ...request, serviceId: '00000000-0000-4000-8000-000000000000' })
    const foreign = await tryBook(anonymousClient(), { ...request, serviceId: norte.serviceId })

    for (const result of [paused, unknown, foreign]) expect(result.error?.message).toBe('slot_unavailable')
    expect(await appointmentsOf(lucero)).toEqual([])
  })

  it('rechaza un negocio que no existe', async () => {
    const lucero = await newBookableBusiness()

    const result = await tryBook(anonymousClient(), { slug: 'no-existe-este-negocio', serviceId: lucero.serviceId, date: monday, time: '10:00' })

    expect(result.error?.message).toBe('business_not_found')
  })
})

describe('datos de quien reserva', () => {
  const INVALID_PHONES: Record<string, string> = {
    'vacío': '',
    'con letras': '549344555abcd',
    'con signo +': '+5493445550142',
    'con espacios': '54 9 3445 550142',
    'de 9 dígitos': '1'.repeat(MIN_PHONE_DIGITS - 1),
    'de 16 dígitos': '1'.repeat(MAX_PHONE_DIGITS + 1),
  }
  const INVALID_NAMES: Record<string, string> = {
    'vacío': '',
    'solo espacios': '   ',
    'de 81 caracteres': 'a'.repeat(MAX_NAME_LENGTH + 1),
  }

  it.each(Object.entries(INVALID_PHONES))('rechaza un celular %s', async (_case, phone) => {
    const lucero = await newBookableBusiness()

    const result = await tryBook(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00', phone })

    expect(result.error?.code).toBe(CHECK_VIOLATION)
    expect(await appointmentsOf(lucero)).toEqual([])
  })

  it.each(Object.entries(INVALID_NAMES))('rechaza un nombre %s', async (_case, name) => {
    const lucero = await newBookableBusiness()

    const result = await tryBook(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00', name })

    expect(result.error?.code).toBe(CHECK_VIOLATION)
    expect(await appointmentsOf(lucero)).toEqual([])
  })

  it.each([MIN_PHONE_DIGITS, MAX_PHONE_DIGITS])('acepta un celular de %i dígitos', async digits => {
    const lucero = await newBookableBusiness()

    const result = await tryBook(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00', phone: '4'.repeat(digits) })

    expect(result.error).toBeNull()
  })

  it('acepta un nombre de 80 caracteres y guarda el nombre sin los espacios de los costados', async () => {
    const lucero = await newBookableBusiness()
    const longName = 'a'.repeat(MAX_NAME_LENGTH)
    await book(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00', name: longName })
    await book(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '11:00', name: '  Marina Ledesma  ', phone: '5493445550144' })

    const stored = await appointmentsOf(lucero)

    expect(stored.map(appointment => appointment.client_name)).toEqual([longName, 'Marina Ledesma'])
  })

  it('no reserva si la persona no aceptó recibir recordatorios por WhatsApp', async () => {
    const lucero = await newBookableBusiness()

    const result = await tryBook(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00', consent: false })

    expect(result.error?.message).toBe('consent_required')
    expect(await appointmentsOf(lucero)).toEqual([])
  })
})

describe('tope de turnos por celular', () => {
  const bookAt = (lucero: BookableBusiness, time: string, phone = SAMPLE_PHONE) =>
    tryBook(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time, phone })

  it('un mismo celular no puede tener más de 3 turnos próximos en un negocio', async () => {
    const lucero = await newBookableBusiness()
    const times = ['09:00', '10:00', '11:00']
    for (const time of times.slice(0, MAX_FUTURE_BOOKINGS_PER_PHONE)) expect((await bookAt(lucero, time)).error).toBeNull()

    const fourth = await bookAt(lucero, '12:00')

    expect(fourth.error?.message).toBe('too_many_bookings')
    expect(await appointmentsOf(lucero)).toHaveLength(MAX_FUTURE_BOOKINGS_PER_PHONE)
  })

  it('otro celular, u otro negocio, tienen su propio tope', async () => {
    const lucero = await newBookableBusiness()
    const norte = await newBookableBusiness()
    for (const time of ['09:00', '10:00', '11:00']) await bookAt(lucero, time)

    expect((await bookAt(lucero, '12:00', '5493445550145')).error).toBeNull()
    expect((await bookAt(norte, '09:00')).error).toBeNull()
  })

  it('un turno cancelado no cuenta para el tope', async () => {
    const lucero = await newBookableBusiness()
    for (const time of ['09:00', '10:00', '11:00']) await bookAt(lucero, time)
    const [first] = await appointmentsOf(lucero)
    await lucero.owner.rpc('cancel_appointment', { p_appointment_id: first!.id })

    expect((await bookAt(lucero, '12:00')).error).toBeNull()
  })
})

describe('turnos del negocio', () => {
  it('otro negocio, y quien no inició sesión, no ven los turnos ajenos', async () => {
    const lucero = await newBookableBusiness()
    const norte = await newBookableBusiness()
    await book(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })

    expect(await appointmentsOf(norte)).toEqual([])
    const visitor = await anonymousClient().from('appointments').select('id')
    expect(visitor.error).toBeNull()
    expect(visitor.data).toEqual([])
  })

  it('nadie escribe directo en la tabla de turnos, ni el negocio ni un visitante', async () => {
    const lucero = await newBookableBusiness()
    await book(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })
    const row = {
      business_id: lucero.id,
      service_name: 'Corte de pelo',
      starts_at: `${monday}T20:00:00Z`,
      ends_at: `${monday}T21:00:00Z`,
      client_name: 'Colado',
      client_phone: SAMPLE_PHONE,
    }

    const byOwner = await lucero.owner.from('appointments').insert(row)
    const byVisitor = await anonymousClient().from('appointments').insert(row)
    const update = await lucero.owner.from('appointments').update({ client_name: 'Cambiado' }).eq('business_id', lucero.id).select('id')
    const removal = await lucero.owner.from('appointments').delete().eq('business_id', lucero.id).select('id')

    expect(byOwner.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    expect(byVisitor.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    expect(update.data).toEqual([])
    expect(removal.data).toEqual([])
    expect((await appointmentsOf(lucero))[0]?.client_name).toBe(SAMPLE_CLIENT_NAME)
  })

  it('la función interna de horarios no se puede llamar desde la API', async () => {
    const lucero = await newBookableBusiness()

    const asVisitor = await anonymousClient().rpc('slots_for', { p_business_id: lucero.id, p_service_id: lucero.serviceId, p_date: monday })
    const asOwner = await lucero.owner.rpc('slots_for', { p_business_id: lucero.id, p_service_id: lucero.serviceId, p_date: monday })

    expect(asVisitor.error?.message).toMatch(/permission denied|Could not find/)
    expect(asOwner.error?.message).toMatch(/permission denied|Could not find/)
  })
})

describe('cancelar un turno', () => {
  it('el negocio cancela un turno y el horario vuelve a estar libre', async () => {
    const lucero = await newBookableBusiness()
    await book(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })
    const [appointment] = await appointmentsOf(lucero)

    const cancelled = await lucero.owner.rpc('cancel_appointment', { p_appointment_id: appointment!.id })

    expect(cancelled.error).toBeNull()
    expect((await appointmentsOf(lucero))[0]?.status).toBe('cancelled')
    expect(await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, monday)).toContain('10:00')
    // Otra persona ya puede reservar ese horario
    expect((await tryBook(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00', phone: '5493445550146' })).error).toBeNull()
  })

  it('cancelar dos veces el mismo turno no da error', async () => {
    const lucero = await newBookableBusiness()
    await book(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })
    const [appointment] = await appointmentsOf(lucero)

    await lucero.owner.rpc('cancel_appointment', { p_appointment_id: appointment!.id })
    const again = await lucero.owner.rpc('cancel_appointment', { p_appointment_id: appointment!.id })

    expect(again.error).toBeNull()
  })

  it('otro negocio no puede cancelar un turno ajeno y el turno sigue en pie', async () => {
    const lucero = await newBookableBusiness()
    const intruder = await newUserClient()
    await book(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })
    const [appointment] = await appointmentsOf(lucero)

    const attempt = await intruder.rpc('cancel_appointment', { p_appointment_id: appointment!.id })

    expect(attempt.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    expect((await appointmentsOf(lucero))[0]?.status).toBe('pending')
  })

  it('quien no inició sesión no puede cancelar, y un turno que no existe da error', async () => {
    const lucero = await newBookableBusiness()
    await book(anonymousClient(), { slug: lucero.slug, serviceId: lucero.serviceId, date: monday, time: '10:00' })
    const [appointment] = await appointmentsOf(lucero)

    const asVisitor = await anonymousClient().rpc('cancel_appointment', { p_appointment_id: appointment!.id })
    const unknown = await lucero.owner.rpc('cancel_appointment', { p_appointment_id: '00000000-0000-4000-8000-000000000000' })

    expect(asVisitor.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    expect(asVisitor.error?.message).toMatch(/permission denied/)
    expect(unknown.error?.message).toBe('appointment_not_found')
    expect((await appointmentsOf(lucero))[0]?.status).toBe('pending')
  })
})
