import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
const sessionState = vi.hoisted(() => ({ status: 'signed-out' as 'signed-out' | 'signed-in' }))
vi.mock('../../app/src/hooks/useSession.ts', () => ({ useSession: () => sessionState }))
import { LandingScreen } from '../../app/src/screens/LandingScreen.tsx'
afterEach(() => {
  sessionState.status = 'signed-out'
  vi.unstubAllGlobals()
})
describe('portada de Cale', () => {
  it('presenta la reserva y la agenda propia sin prometer WhatsApp activo', () => {
    vi.stubGlobal('window', { location: { search: '', hash: '' } })
    const html = renderToStaticMarkup(createElement(LandingScreen))
    expect(html).toContain('Tus reservas online,')
    expect(html).toContain('tu día en orden.')
    expect(html).not.toContain('Cale les recuerda el turno por WhatsApp')
    expect(html).toContain('WhatsApp · Próximamente')
    expect(html).toContain('Esta demostración no crea una reserva')
    expect(html).toContain('Confirmo')
    expect(html).toContain('Cancelo')
    expect(html).toContain('Cargá tu negocio, servicios, horarios y tus colores de marca.')
    expect(html).toContain('Compartilo en Instagram, WhatsApp o con un QR físico en tu negocio.')
    expect(html).toContain('Recibí notificaciones de nuevos turnos y gestioná tus reservas.')
    expect(html).toContain('Nuevos turnos, cancelaciones y cambios de horario, siempre al tanto.')
    expect(html).not.toContain('Cambiar horario')
    expect(html).not.toContain('Google Calendar')
    expect(html).toContain('Empezá Gratis')
    expect(html).not.toMatch(/7 días|30 días/i)
  })
  it('un rechazo de OAuth ofrece volver a intentar el ingreso', () => {
    vi.stubGlobal('window', { location: { search: '', hash: '#error=access_denied' } })
    expect(renderToStaticMarkup(createElement(LandingScreen))).toContain('No pudimos completar el ingreso con Google')
  })
  it('mantiene el landing para una persona autenticada y ofrece volver al panel', () => {
    sessionState.status = 'signed-in'
    vi.stubGlobal('window', { location: { search: '', hash: '' } })
    const html = renderToStaticMarkup(createElement(LandingScreen))
    expect(html).toContain('Ir a mi negocio')
  })
})
