import { describe, expect, it } from 'vitest'
import { newBookableBusiness, slotsFor } from '../support/booking.ts'
import { addDays, argentinaTime, argentinaToday, minutesSinceMidnight, nextDateOnWeekday } from '../support/dates.ts'
import { createService } from '../support/services.ts'
import { anonymousClient } from '../support/users.ts'
import { MONDAY, type HoursRange } from '../support/working-hours.ts'

describe('página pública de un negocio', () => {
  it('cualquiera, sin sesión, ve el nombre, los servicios activos y los días que atiende', async () => {
    const lucero = await newBookableBusiness()
    const paused = await createService(lucero.owner, lucero.id, 'Servicio pausado', 30)
    await lucero.owner.from('services').update({ active: false }).eq('id', paused.id)

    const info = await anonymousClient().rpc('get_public_booking_info', { p_slug: lucero.slug })

    expect(info.error).toBeNull()
    expect(info.data).toEqual({
      name: 'Peluquería Lucero',
      slug: lucero.slug,
      services: [{ id: lucero.serviceId, name: 'Corte de pelo', duration_minutes: 60 }],
      open_days: [1, 2, 3, 4, 5],
    })
  })

  it('un slug que no existe devuelve vacío, no un error', async () => {
    const info = await anonymousClient().rpc('get_public_booking_info', { p_slug: 'no-existe-este-negocio' })

    expect(info.error).toBeNull()
    expect(info.data).toBeNull()
  })
})

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const everyDay = (start: string, end: string): HoursRange[] => ALL_DAYS.map(day => ({ day_of_week: day, start_time: start, end_time: end }))

// Reglas de reserva
const MIN_NOTICE_MINUTES = 2 * 60
const MAX_DAYS_AHEAD = 30
const HALF_HOUR_SLOTS_PER_DAY = 48

describe('horarios libres', () => {
  const monday = nextDateOnWeekday(MONDAY, 3)

  it('ofrece un turno cada tantos minutos como dura el servicio, mientras entre en el horario', async () => {
    const lucero = await newBookableBusiness({ serviceMinutes: 60 })

    expect(await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, monday)).toEqual([
      '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    ])
  })

  it('un servicio de 90 minutos termina justo a las 18:00 y no más tarde', async () => {
    const lucero = await newBookableBusiness({ serviceMinutes: 90 })

    expect(await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, monday)).toEqual([
      '09:00', '10:30', '12:00', '13:30', '15:00', '16:30',
    ])
  })

  it('no ofrece turnos que se meten en el descanso', async () => {
    const lucero = await newBookableBusiness({
      ranges: [
        { day_of_week: MONDAY, start_time: '09:00', end_time: '13:00' },
        { day_of_week: MONDAY, start_time: '14:00', end_time: '18:00' },
      ],
    })

    expect(await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, monday)).toEqual([
      '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00',
    ])
  })

  it('un día sin horario no tiene turnos', async () => {
    const lucero = await newBookableBusiness()
    const sunday = nextDateOnWeekday(0, 3)

    expect(await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, sunday)).toEqual([])
  })

  it('ofrece turnos hasta 30 días adelante y ninguno ayer ni a los 31 días', async () => {
    const lucero = await newBookableBusiness({ ranges: everyDay('09:00', '18:00') })
    const slots = (date: string) => slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, date)
    const today = argentinaToday()

    expect(await slots(addDays(today, MAX_DAYS_AHEAD))).not.toEqual([])
    expect(await slots(addDays(today, MAX_DAYS_AHEAD + 1))).toEqual([])
    expect(await slots(addDays(today, -1))).toEqual([])
  })

  it('hoy solo ofrece turnos que empiezan con al menos 2 horas de anticipación', async () => {
    const lucero = await newBookableBusiness({ serviceMinutes: 30, ranges: everyDay('00:00', '24:00') })
    const earliest = minutesSinceMidnight(argentinaTime()) + MIN_NOTICE_MINUTES

    const today = await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, argentinaToday())

    for (const slot of today) expect(minutesSinceMidnight(slot)).toBeGreaterThanOrEqual(earliest)
    // Pasado mañana hay un turno cada media hora, todo el día; hoy siempre faltan los de las primeras 2 horas
    // (mañana a las 00:00 también puede caer dentro de las 2 horas si ya es tarde)
    expect(today.length).toBeLessThan(HALF_HOUR_SLOTS_PER_DAY)
    expect(await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, addDays(argentinaToday(), 2))).toHaveLength(HALF_HOUR_SLOTS_PER_DAY)
  })

  it('no ofrece turnos de un servicio pausado', async () => {
    const lucero = await newBookableBusiness()
    await lucero.owner.from('services').update({ active: false }).eq('id', lucero.serviceId)

    expect(await slotsFor(anonymousClient(), lucero.slug, lucero.serviceId, monday)).toEqual([])
  })

  it('no ofrece turnos de un servicio que es de otro negocio, aunque ese servicio esté activo', async () => {
    const lucero = await newBookableBusiness()
    const norte = await newBookableBusiness()

    expect(await slotsFor(anonymousClient(), norte.slug, norte.serviceId, monday)).not.toEqual([])
    expect(await slotsFor(anonymousClient(), lucero.slug, norte.serviceId, monday)).toEqual([])
  })

  it('un negocio que no existe no tiene turnos', async () => {
    const lucero = await newBookableBusiness()

    expect(await slotsFor(anonymousClient(), 'no-existe-este-negocio', lucero.serviceId, monday)).toEqual([])
  })
})
