import { describe, expect, it } from 'vitest'
import { designVariant, designScreen, DEMO_APPOINTMENTS, endTime } from '../../app/src/designs/model.ts'
describe('rutas de las propuestas', () => {
  it.each(['natural', 'clara', 'editorial'])('permite abrir %s por su URL', variant => {
    expect(designVariant(`/disenos/${variant}`)).toBe(variant)
    expect(designVariant(`/disenos/${variant}/`)).toBe(variant)
  })
  it.each(['/disenos/otra', '/natural', '/disenos/natural/agenda', '/negocio-demo'])('no interpreta %s como propuesta', path => {
    expect(designVariant(path)).toBeNull()
  })
  it('conserva la pantalla al compartir el enlace', () => {
    expect(designScreen('?vista=reserva&embed=1')).toBe('reserva')
    expect(designScreen('?vista=agenda')).toBe('agenda')
    expect(designScreen('?vista=inexistente')).toBe('portada')
  })
})
describe('contenido comparable de demostración', () => {
  it('los cuatro turnos tienen horas válidas y diferentes', () => {
    expect(DEMO_APPOINTMENTS).toHaveLength(4)
    expect(new Set(DEMO_APPOINTMENTS.map(item => item.time)).size).toBe(4)
  })
  it('calcula el fin incluyendo minutos y cambios de hora', () => {
    expect(endTime('10:30', 60)).toBe('11:30')
    expect(endTime('09:45', 30)).toBe('10:15')
  })
})
