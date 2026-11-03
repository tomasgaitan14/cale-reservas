import { describe, expect, it } from 'vitest'
import { describeServiceError } from '../../app/src/lib/service-errors.ts'

// Los mensajes son los que devuelve la API de Supabase con la base real (se comprobaron con las migraciones aplicadas)
const NAME_TAKEN = { code: '23505', message: 'duplicate key value violates unique constraint "services_business_name_unique"' }
const NAME_LENGTH = { code: '23514', message: 'new row for relation "services" violates check constraint "services_name_length"' }
const DURATION_RANGE = { code: '23514', message: 'new row for relation "services" violates check constraint "services_duration_range"' }

describe('describeServiceError', () => {
  it.each([
    ['un nombre repetido', NAME_TAKEN, 'name'],
    ['un nombre inválido', NAME_LENGTH, 'name'],
    ['una duración inválida', DURATION_RANGE, 'duration'],
  ])('marca el campo correcto ante %s', (_case, error, field) => {
    const errors = describeServiceError(error)
    expect(Object.keys(errors)).toEqual([field])
    expect(errors[field as keyof typeof errors]).toBeTruthy()
  })

  it('explica distinto un nombre repetido y uno inválido', () => {
    expect(describeServiceError(NAME_TAKEN).name).not.toBe(describeServiceError(NAME_LENGTH).name)
  })

  it('pide entrar de nuevo si la sesión venció', () => {
    const errors = describeServiceError({ code: '42501', message: 'new row violates row-level security policy for table "services"' })
    expect(Object.keys(errors)).toEqual(['general'])
    expect(errors.general).toMatch(/sesión/)
  })

  it('devuelve un mensaje general ante un error que no conoce, sin mostrar el detalle técnico', () => {
    const errors = describeServiceError({ code: 'XX000', message: 'internal error at pg_catalog' })
    expect(Object.keys(errors)).toEqual(['general'])
    expect(errors.general).not.toMatch(/pg_catalog/)
  })
})
