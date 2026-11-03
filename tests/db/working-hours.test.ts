import { describe, expect, it } from 'vitest'
import { createBusiness } from '../support/businesses.ts'
import { CHECK_VIOLATION, EXCLUSION_VIOLATION, INSUFFICIENT_PRIVILEGE } from '../support/pg-errors.ts'
import { anonymousClient, newUserClient } from '../support/users.ts'
import { MONDAY, readHours, saveHours, THURSDAY, trySaveHours, TUESDAY, WEEKDAYS, type HoursRange } from '../support/working-hours.ts'

// Límite de tramos que acepta replace_working_hours: siete días con diez tramos cada uno
const MAX_RANGES = 70
const DAYS_IN_WEEK = 7

// Tramos válidos y sin superponerse: uno por hora y por día, de HH:00 a HH:30
function validRanges(count: number): HoursRange[] {
  return Array.from({ length: count }, (_, index) => {
    const hour = String(Math.floor(index / DAYS_IN_WEEK)).padStart(2, '0')
    return { day_of_week: index % DAYS_IN_WEEK, start_time: `${hour}:00`, end_time: `${hour}:30` }
  })
}

describe('horario semanal', () => {
  it('un dueño guarda su horario y lo lee ordenado por día y hora', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')

    await saveHours(lucia, lucero.id, [
      { day_of_week: THURSDAY, start_time: '09:00', end_time: '18:00' },
      { day_of_week: MONDAY, start_time: '10:30', end_time: '16:00' },
    ])

    expect(await readHours(lucia)).toEqual([
      { day_of_week: MONDAY, start_time: '10:30:00', end_time: '16:00:00' },
      { day_of_week: THURSDAY, start_time: '09:00:00', end_time: '18:00:00' },
    ])
  })

  it('guardar de nuevo reemplaza el horario anterior en vez de sumarlo', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    await saveHours(lucia, lucero.id, [{ day_of_week: MONDAY, start_time: '09:00', end_time: '18:00' }])

    await saveHours(lucia, lucero.id, [{ day_of_week: TUESDAY, start_time: '10:00', end_time: '14:00' }])

    expect(await readHours(lucia)).toEqual([{ day_of_week: TUESDAY, start_time: '10:00:00', end_time: '14:00:00' }])
  })

  it('un día puede tener varios tramos, con un descanso en el medio o pegados uno al otro', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')

    await saveHours(lucia, lucero.id, [
      { day_of_week: MONDAY, start_time: '09:00', end_time: '13:00' },
      { day_of_week: MONDAY, start_time: '14:00', end_time: '18:00' },
      { day_of_week: TUESDAY, start_time: '09:00', end_time: '13:00' },
      { day_of_week: TUESDAY, start_time: '13:00', end_time: '18:00' },
    ])

    expect(await readHours(lucia)).toHaveLength(4)
  })

  it('el mismo tramo se puede repetir en días distintos', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')

    await saveHours(lucia, lucero.id, WEEKDAYS.map(day => ({ day_of_week: day, start_time: '09:00', end_time: '18:00' })))

    expect(await readHours(lucia)).toHaveLength(WEEKDAYS.length)
  })

  it('guardar una lista vacía deja el negocio sin horario', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    await saveHours(lucia, lucero.id, [{ day_of_week: MONDAY, start_time: '09:00', end_time: '18:00' }])

    await saveHours(lucia, lucero.id, [])

    expect(await readHours(lucia)).toEqual([])
  })

  it('acepta un tramo de todo el día, de 00:00 a 24:00', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')

    await saveHours(lucia, lucero.id, [{ day_of_week: MONDAY, start_time: '00:00', end_time: '24:00' }])

    expect(await readHours(lucia)).toEqual([{ day_of_week: MONDAY, start_time: '00:00:00', end_time: '24:00:00' }])
  })
})

describe('validación del horario', () => {
  const VALID_BEFORE: HoursRange[] = [{ day_of_week: MONDAY, start_time: '09:00', end_time: '18:00' }]
  const monday = (start: string, end: string): HoursRange => ({ day_of_week: MONDAY, start_time: start, end_time: end })

  const CHECK_CASES: Record<string, unknown> = {
    'un tramo que termina cuando empieza': [monday('09:00', '09:00')],
    'un tramo que termina antes de empezar': [monday('18:00', '09:00')],
    'el día -1': [{ day_of_week: -1, start_time: '09:00', end_time: '18:00' }],
    'el día 7': [{ day_of_week: 7, start_time: '09:00', end_time: '18:00' }],
    'más de 70 tramos, todos válidos': validRanges(MAX_RANGES + 1),
  }
  const MALFORMED_CASES: Record<string, unknown> = {
    'una hora que no existe': [monday('09:00', '25:00')],
    'una hora con texto': [monday('abc', '18:00')],
    'un tramo sin hora de fin': [{ day_of_week: MONDAY, start_time: '09:00' }],
    'algo que no es una lista': { day_of_week: MONDAY },
    'una lista nula': null,
  }

  it.each(Object.entries(CHECK_CASES))('rechaza %s y conserva el horario anterior', async (_case, ranges) => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    await saveHours(lucia, lucero.id, VALID_BEFORE)

    const result = await trySaveHours(lucia, lucero.id, ranges)

    expect(result.error?.code).toBe(CHECK_VIOLATION)
    expect(await readHours(lucia)).toHaveLength(VALID_BEFORE.length)
  })

  it.each(Object.entries(MALFORMED_CASES))('rechaza %s y conserva el horario anterior', async (_case, ranges) => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    await saveHours(lucia, lucero.id, VALID_BEFORE)

    const result = await trySaveHours(lucia, lucero.id, ranges)

    expect(result.error).not.toBeNull()
    expect(await readHours(lucia)).toEqual([{ day_of_week: MONDAY, start_time: '09:00:00', end_time: '18:00:00' }])
  })

  it('acepta justo 70 tramos', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')

    await saveHours(lucia, lucero.id, validRanges(MAX_RANGES))

    expect(await readHours(lucia)).toHaveLength(MAX_RANGES)
  })

  it('rechaza dos tramos que se pisan el mismo día y no guarda ninguno', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    await saveHours(lucia, lucero.id, VALID_BEFORE)

    const result = await trySaveHours(lucia, lucero.id, [monday('09:00', '13:00'), monday('12:00', '18:00'), { ...monday('08:00', '09:00'), day_of_week: TUESDAY }])

    expect(result.error?.code).toBe(EXCLUSION_VIOLATION)
    expect(await readHours(lucia)).toEqual([{ day_of_week: MONDAY, start_time: '09:00:00', end_time: '18:00:00' }])
  })
})

describe('aislamiento del horario', () => {
  it('otro usuario con sesión no ve el horario ajeno', async () => {
    const lucia = await newUserClient()
    const mateo = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    await saveHours(lucia, lucero.id, [{ day_of_week: MONDAY, start_time: '09:00', end_time: '18:00' }])

    expect(await readHours(mateo)).toEqual([])
  })

  it('otro usuario no puede reemplazar el horario de un negocio ajeno', async () => {
    const lucia = await newUserClient()
    const mateo = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    await saveHours(lucia, lucero.id, [{ day_of_week: MONDAY, start_time: '09:00', end_time: '18:00' }])

    const attempt = await trySaveHours(mateo, lucero.id, [{ day_of_week: TUESDAY, start_time: '00:00', end_time: '23:00' }])

    expect(attempt.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    expect(await readHours(lucia)).toEqual([{ day_of_week: MONDAY, start_time: '09:00:00', end_time: '18:00:00' }])
  })

  it('sin sesión no se puede leer ni guardar un horario', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    await saveHours(lucia, lucero.id, [{ day_of_week: MONDAY, start_time: '09:00', end_time: '18:00' }])
    const visitor = anonymousClient()

    expect(await readHours(visitor)).toEqual([])
    const attempt = await trySaveHours(visitor, lucero.id, [])
    expect(attempt.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    // Lo frena el permiso de ejecución, no solo el control de membresía de la función
    expect(attempt.error?.message).toMatch(/permission denied/)
    expect(await readHours(lucia)).toHaveLength(1)
  })

  it('nadie escribe directo en la tabla, ni el dueño: se guarda solo con replace_working_hours', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    await saveHours(lucia, lucero.id, [{ day_of_week: MONDAY, start_time: '09:00', end_time: '18:00' }])

    const insert = await lucia
      .from('working_hours')
      .insert({ business_id: lucero.id, day_of_week: TUESDAY, start_time: '09:00', end_time: '18:00' })
    expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE)

    const update = await lucia.from('working_hours').update({ end_time: '23:00' }).eq('business_id', lucero.id).select('id')
    expect(update.data).toEqual([])
    const removal = await lucia.from('working_hours').delete().eq('business_id', lucero.id).select('id')
    expect(removal.data).toEqual([])

    expect(await readHours(lucia)).toEqual([{ day_of_week: MONDAY, start_time: '09:00:00', end_time: '18:00:00' }])
  })
})
