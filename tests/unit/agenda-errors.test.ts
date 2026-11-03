import { describe, expect, it } from 'vitest'
import { describeAgendaError } from '../../app/src/lib/agenda-errors.ts'

// Los mensajes son los que devuelve la API de Supabase con la base real (se comprobaron con las migraciones aplicadas)
const OVERLAPS_APPOINTMENT = { code: 'P0001', message: 'overlaps_appointment' }
const SLOT_UNAVAILABLE = { code: 'P0001', message: 'slot_unavailable' }
const IN_THE_PAST = { code: 'P0001', message: 'in_the_past' }
const TOO_FAR = { code: 'P0001', message: 'too_far' }
const SERVICE_NOT_FOUND = { code: 'P0001', message: 'service_not_found' }
const NAME_LENGTH = { code: '23514', message: 'new row for relation "appointments" violates check constraint "appointments_client_name_length"' }
const PHONE_FORMAT = { code: '23514', message: 'new row for relation "appointments" violates check constraint "appointments_client_phone_format"' }
const END_AFTER_START = { code: '23514', message: 'new row for relation "time_blocks" violates check constraint "time_blocks_end_after_start"' }
const MAX_LENGTH = { code: '23514', message: 'new row for relation "time_blocks" violates check constraint "time_blocks_max_length"' }
const REASON_LENGTH = { code: '23514', message: 'new row for relation "time_blocks" violates check constraint "time_blocks_reason_length"' }

describe('describeAgendaError', () => {
  it.each([
    ['un bloqueo que pisa un turno', OVERLAPS_APPOINTMENT, 'time'],
    ['un horario ocupado', SLOT_UNAVAILABLE, 'time'],
    ['una fecha que ya pasó', IN_THE_PAST, 'time'],
    ['una fecha demasiado lejana', TOO_FAR, 'time'],
    ['un servicio que no existe', SERVICE_NOT_FOUND, 'service'],
    ['un nombre inválido', NAME_LENGTH, 'name'],
    ['un celular inválido', PHONE_FORMAT, 'phone'],
    ['un bloqueo que termina antes de empezar', END_AFTER_START, 'time'],
    ['un bloqueo demasiado largo', MAX_LENGTH, 'time'],
    ['un motivo demasiado largo', REASON_LENGTH, 'reason'],
  ])('marca dónde mostrar el error ante %s', (_case, error, field) => {
    const errors = describeAgendaError(error)
    expect(Object.keys(errors)).toEqual([field])
    expect(errors[field as keyof typeof errors]).toBeTruthy()
  })

  it('explica distinto un bloqueo que pisa un turno y un horario ocupado', () => {
    expect(describeAgendaError(OVERLAPS_APPOINTMENT).time).not.toBe(describeAgendaError(SLOT_UNAVAILABLE).time)
  })

  it('al pisar un turno le dice al negocio que primero tiene que cancelarlo', () => {
    expect(describeAgendaError(OVERLAPS_APPOINTMENT).time).toMatch(/cancel/i)
  })

  it('pide entrar de nuevo si la sesión venció', () => {
    const errors = describeAgendaError({ code: '42501', message: 'not_a_member' })
    expect(Object.keys(errors)).toEqual(['general'])
    expect(errors.general).toMatch(/sesión/)
  })

  it('devuelve un mensaje general ante un error que no conoce, sin mostrar el detalle técnico', () => {
    const errors = describeAgendaError({ code: 'XX000', message: 'internal error at pg_catalog' })
    expect(Object.keys(errors)).toEqual(['general'])
    expect(errors.general).not.toMatch(/pg_catalog/)
  })
})
