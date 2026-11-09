import { describe, expect, it } from 'vitest'
import { bookingUrl, invitation, nextSetupStep, REMINDER_OPTIONS } from '../../app/src/lib/onboarding.ts'

describe('el alta retoma el primer requisito incompleto', () => {
  it.each([
    [0, false, false, 'services'], [0, true, true, 'services'],
    [1, false, false, 'hours'], [2, false, true, 'hours'],
    [1, true, false, 'ready'], [1, true, true, 'ready'],
  ] as const)('con %s servicios, horarios=%s, recordatorios=%s retoma %s', (count, hours, reviewed, expected) => {
    expect(nextSetupStep(count, hours)).toBe(expected)
  })
  it('la anticipación queda limitada a las tres opciones acordadas', () => {
    expect(REMINDER_OPTIONS).toEqual([24, 48, 2])
  })
})
describe('compartir reservas usa la dirección pública del negocio', () => {
  it('el link usa el mismo prefijo que alta y edición del negocio', () => {
    expect(bookingUrl('peluqueria-miguelon')).toBe('https://cale.com.ar/peluqueria-miguelon')
  })
  it('conserva exactamente el identificador guardado del negocio', () => {
    expect(bookingUrl('peluqueria-miguelon-2')).toBe('https://cale.com.ar/peluqueria-miguelon-2')
  })
  it('el mensaje conserva el nombre y el link que se copian', () => {
    const url = bookingUrl('negocio-demo')
    const text = invitation('Negocio demo', url)
    expect(text).toContain('Negocio demo')
    expect(text).toContain('https://cale.com.ar/negocio-demo')
    expect(text).not.toContain('vercel.app')
  })
})
