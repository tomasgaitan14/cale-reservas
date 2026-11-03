import { describe, expect, it } from 'vitest'
import { describeCreateBusinessError } from '../../app/src/lib/business-errors.ts'

// Los mensajes son los que devuelve la API de Supabase con la base real (se comprobaron con las migraciones aplicadas)
const SLUG_TAKEN = { code: '23505', message: 'duplicate key value violates unique constraint "businesses_slug_key"' }
const SLUG_RESERVED = { code: '23514', message: 'slug_reserved' }
const SLUG_FORMAT = { code: '23514', message: 'new row for relation "businesses" violates check constraint "businesses_slug_format"' }
const NAME_LENGTH = { code: '23514', message: 'new row for relation "businesses" violates check constraint "businesses_name_length"' }
const WHATSAPP_FORMAT = { code: '23514', message: 'new row for relation "businesses" violates check constraint "businesses_whatsapp_format"' }

describe('describeCreateBusinessError', () => {
  it.each([
    ['un slug repetido', SLUG_TAKEN, 'slug'],
    ['un slug reservado', SLUG_RESERVED, 'slug'],
    ['un slug con formato inválido', SLUG_FORMAT, 'slug'],
    ['un nombre inválido', NAME_LENGTH, 'name'],
    ['un WhatsApp inválido', WHATSAPP_FORMAT, 'whatsapp'],
  ])('marca el campo correcto ante %s', (_case, error, field) => {
    const errors = describeCreateBusinessError(error)
    expect(Object.keys(errors)).toEqual([field])
    expect(errors[field as keyof typeof errors]).toBeTruthy()
  })

  it('explica distinto un slug repetido y uno reservado', () => {
    expect(describeCreateBusinessError(SLUG_TAKEN).slug).not.toBe(describeCreateBusinessError(SLUG_RESERVED).slug)
  })

  it('pide entrar de nuevo si la sesión venció', () => {
    const errors = describeCreateBusinessError({ code: '42501', message: 'permission denied for function create_business' })
    expect(Object.keys(errors)).toEqual(['general'])
    expect(errors.general).toMatch(/sesión/)
  })

  it('devuelve un mensaje general ante un error que no conoce, sin mostrar el detalle técnico', () => {
    const errors = describeCreateBusinessError({ code: 'XX000', message: 'internal error at pg_catalog' })
    expect(Object.keys(errors)).toEqual(['general'])
    expect(errors.general).not.toMatch(/pg_catalog/)
  })
})
