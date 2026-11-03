import { describe, expect, it } from 'vitest'
import { describeBookingError } from '../../app/src/lib/booking-errors.ts'

// Los mensajes son los que devuelve la API de Supabase con la base real (se comprobaron con las migraciones aplicadas)
const SLOT_UNAVAILABLE = { code: 'P0001', message: 'slot_unavailable' }
const CONSENT_REQUIRED = { code: 'P0001', message: 'consent_required' }
const TOO_MANY = { code: 'P0001', message: 'too_many_bookings' }
const BUSINESS_NOT_FOUND = { code: 'P0001', message: 'business_not_found' }
const NAME_LENGTH = { code: '23514', message: 'new row for relation "appointments" violates check constraint "appointments_client_name_length"' }
const PHONE_FORMAT = { code: '23514', message: 'new row for relation "appointments" violates check constraint "appointments_client_phone_format"' }

describe('describeBookingError', () => {
  it.each([
    ['un horario ocupado', SLOT_UNAVAILABLE, 'slot'],
    ['no aceptar los recordatorios', CONSENT_REQUIRED, 'consent'],
    ['un nombre inválido', NAME_LENGTH, 'name'],
    ['un celular inválido', PHONE_FORMAT, 'phone'],
    ['demasiados turnos', TOO_MANY, 'general'],
    ['un negocio que no existe', BUSINESS_NOT_FOUND, 'general'],
  ])('marca dónde mostrar el error ante %s', (_case, error, field) => {
    const errors = describeBookingError(error)
    expect(Object.keys(errors)).toEqual([field])
    expect(errors[field as keyof typeof errors]).toBeTruthy()
  })

  it('le dice a quien reserva que elija otro horario cuando el suyo se ocupó', () => {
    expect(describeBookingError(SLOT_UNAVAILABLE).slot).toMatch(/otro/)
  })

  it('un negocio que no existe tiene su propio mensaje, distinto al de un error desconocido', () => {
    const unknown = describeBookingError({ code: 'XX000', message: 'internal error' })

    expect(describeBookingError(BUSINESS_NOT_FOUND).general).not.toBe(unknown.general)
  })

  it('explica el tope de turnos con el número', () => {
    expect(describeBookingError(TOO_MANY).general).toMatch(/3/)
  })

  it('devuelve un mensaje general ante un error que no conoce, sin mostrar el detalle técnico', () => {
    const errors = describeBookingError({ code: 'XX000', message: 'internal error at pg_catalog' })
    expect(Object.keys(errors)).toEqual(['general'])
    expect(errors.general).not.toMatch(/pg_catalog/)
  })
})
