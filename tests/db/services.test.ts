import { describe, expect, it } from 'vitest'
import { createBusiness } from '../support/businesses.ts'
import { CHECK_VIOLATION, INSUFFICIENT_PRIVILEGE, UNIQUE_VIOLATION } from '../support/pg-errors.ts'
import { createService } from '../support/services.ts'
import { anonymousClient, newUserClient } from '../support/users.ts'

// Límites de las reglas de negocio
const MAX_NAME_LENGTH = 80
const MIN_DURATION = 5
const MAX_DURATION = 480

describe('servicios', () => {
  it('un dueño crea un servicio y lo ve en su lista', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')

    const created = await lucia.from('services').insert({ business_id: lucero.id, name: 'Corte de pelo', duration_minutes: 45 })
    expect(created.error).toBeNull()

    const listed = await lucia.from('services').select('name, duration_minutes, active')
    expect(listed.error).toBeNull()
    expect(listed.data).toEqual([{ name: 'Corte de pelo', duration_minutes: 45, active: true }])
  })

  it('otro usuario con sesión no ve los servicios ajenos', async () => {
    const lucia = await newUserClient()
    const mateo = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    const norte = await createBusiness(mateo, 'Estética del Norte', 'norte')
    await createService(lucia, lucero.id, 'Corte de pelo', 45)
    await createService(mateo, norte.id, 'Limpieza facial', 60)

    const mateoList = await mateo.from('services').select('name')
    expect(mateoList.error).toBeNull()
    expect(mateoList.data).toEqual([{ name: 'Limpieza facial' }])
  })

  it('otro usuario no puede crear, modificar ni borrar servicios en un negocio ajeno', async () => {
    const lucia = await newUserClient()
    const mateo = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    const corte = await createService(lucia, lucero.id, 'Corte de pelo', 45)

    const intruder = await mateo.from('services').insert({ business_id: lucero.id, name: 'Colado', duration_minutes: 30 })
    expect(intruder.error?.code).toBe(INSUFFICIENT_PRIVILEGE)

    // La seguridad por filas no devuelve error al modificar o borrar: simplemente no toca ninguna fila
    const update = await mateo.from('services').update({ name: 'Cambiado por Mateo' }).eq('id', corte.id).select('id')
    expect(update.error).toBeNull()
    expect(update.data).toEqual([])
    const removal = await mateo.from('services').delete().eq('id', corte.id).select('id')
    expect(removal.error).toBeNull()
    expect(removal.data).toEqual([])

    const luciaList = await lucia.from('services').select('name')
    expect(luciaList.data).toEqual([{ name: 'Corte de pelo' }])
  })

  it('sin sesión no se pueden ver ni crear servicios', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    await createService(lucia, lucero.id, 'Corte de pelo', 45)
    const visitor = anonymousClient()

    const listed = await visitor.from('services').select('name')
    // Sin sesión no hay ningún permiso de lectura: es un rechazo, no una lista vacía
    expect(listed.error?.code).toBe(INSUFFICIENT_PRIVILEGE)

    const created = await visitor.from('services').insert({ business_id: lucero.id, name: 'Colado', duration_minutes: 30 })
    expect(created.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
  })

  it('el dueño puede cambiar el nombre y la duración, desactivar y borrar un servicio', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    const corte = await createService(lucia, lucero.id, 'Corte de pelo', 45)

    const update = await lucia
      .from('services')
      .update({ name: 'Corte y peinado', duration_minutes: 60, active: false })
      .eq('id', corte.id)
      .select('name, duration_minutes, active')
    expect(update.error).toBeNull()
    expect(update.data).toEqual([{ name: 'Corte y peinado', duration_minutes: 60, active: false }])

    const removal = await lucia.from('services').delete().eq('id', corte.id).select('id')
    expect(removal.error).toBeNull()
    expect(removal.data).toEqual([{ id: corte.id }])
    expect((await lucia.from('services').select('id')).data).toEqual([])
  })
})

describe('validación de servicios', () => {
  const INVALID_NAMES: Record<string, string> = {
    'vacío': '',
    'solo espacios': '   ',
    'de 81 caracteres': 'a'.repeat(MAX_NAME_LENGTH + 1),
  }
  const INVALID_DURATIONS: Record<string, number> = {
    'de 0 minutos': 0,
    'negativa': -15,
    'de 4 minutos': MIN_DURATION - 1,
    'de 481 minutos': MAX_DURATION + 1,
  }

  it.each(Object.entries(INVALID_NAMES))('rechaza un nombre %s', async (_case, name) => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    const result = await lucia.from('services').insert({ business_id: lucero.id, name, duration_minutes: 30 })
    expect(result.error?.code).toBe(CHECK_VIOLATION)
  })

  it.each(Object.entries(INVALID_DURATIONS))('rechaza una duración %s', async (_case, duration) => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    const result = await lucia.from('services').insert({ business_id: lucero.id, name: 'Corte de pelo', duration_minutes: duration })
    expect(result.error?.code).toBe(CHECK_VIOLATION)
  })

  it.each([MIN_DURATION, MAX_DURATION])('acepta una duración de %i minutos', async duration => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    const result = await lucia.from('services').insert({ business_id: lucero.id, name: 'Corte de pelo', duration_minutes: duration })
    expect(result.error).toBeNull()
  })

  it('acepta un nombre de 80 caracteres', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    const result = await lucia.from('services').insert({ business_id: lucero.id, name: 'a'.repeat(MAX_NAME_LENGTH), duration_minutes: 30 })
    expect(result.error).toBeNull()
  })

  it('rechaza repetir el nombre de un servicio en el mismo negocio, aunque cambien las mayúsculas o los espacios', async () => {
    const lucia = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    await createService(lucia, lucero.id, 'Corte de pelo', 45)

    const duplicate = await lucia.from('services').insert({ business_id: lucero.id, name: '  CORTE DE PELO ', duration_minutes: 30 })
    expect(duplicate.error?.code).toBe(UNIQUE_VIOLATION)
  })

  it('permite el mismo nombre de servicio en negocios distintos', async () => {
    const lucia = await newUserClient()
    const mateo = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    const norte = await createBusiness(mateo, 'Estética del Norte', 'norte')
    await createService(lucia, lucero.id, 'Corte de pelo', 45)

    const other = await mateo.from('services').insert({ business_id: norte.id, name: 'Corte de pelo', duration_minutes: 45 })
    expect(other.error).toBeNull()
  })
})
