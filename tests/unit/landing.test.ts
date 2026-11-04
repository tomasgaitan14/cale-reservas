import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../app/src/hooks/useSession.ts', () => ({ useSession: () => ({ status: 'signed-out' }) }))
import { LandingScreen } from '../../app/src/screens/LandingScreen.tsx'
afterEach(() => vi.unstubAllGlobals())
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
    expect(html).not.toContain('Cambiar horario')
    expect(html).not.toContain('Google Calendar')
    expect(html).not.toMatch(/gratis|30 días|\$\d/i)
  })
  it('un rechazo de OAuth ofrece volver a intentar el ingreso', () => {
    vi.stubGlobal('window', { location: { search: '', hash: '#error=access_denied' } })
    expect(renderToStaticMarkup(createElement(LandingScreen))).toContain('No pudimos completar el ingreso con Google')
  })
})
