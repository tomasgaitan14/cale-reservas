import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../app/src/lib/supabase.ts', () => ({ supabase: {} }))
import { BusinessScreen } from '../../app/src/screens/BusinessScreen.tsx'
import { RemindersScreen } from '../../app/src/screens/RemindersScreen.tsx'
import { defaultPreferences } from '../../app/src/lib/preferences.ts'
const business = { id: 'business-demo', name: 'Negocio demo', slug: 'negocio-demo', whatsapp: '540000000000' }
afterEach(() => vi.unstubAllGlobals())
describe('contenido y honestidad del panel', () => {
  it('no expone un link ni QR antes de tener servicio y horarios', () => {
    const html = renderToStaticMarkup(createElement(BusinessScreen, { business, ready: false, onChanged: vi.fn(), onServices: vi.fn(), onHours: vi.fn() }))
    expect(html).toContain('cuando tengas al menos un servicio activo y horarios')
    expect(html).not.toContain('Copiar link')
    expect(html).not.toContain('Guardar QR')
  })
  it('el link y el mensaje usan la dirección pública aunque el panel se abra en otro entorno', () => {
    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:5174' } })
    const html = renderToStaticMarkup(createElement(BusinessScreen, { business, ready: true, onChanged: vi.fn(), onServices: vi.fn(), onHours: vi.fn() }))
    expect(html).toContain('https://app.cale.com.ar/negocio-demo')
    expect(html).toContain('Copiar mensaje')
    expect(html).not.toContain('http://127.0.0.1:5174/negocio-demo')
  })
  it('WhatsApp es una vista previa con dos respuestas y no una conexión simulada', () => {
    const html = renderToStaticMarkup(createElement(RemindersScreen, { business, preferences: defaultPreferences(business.id), onSaved: vi.fn() }))
    expect(html).toContain('Todavía no se envían mensajes')
    expect(html).toContain('Confirmo')
    expect(html).toContain('Cancelo')
    expect(html).not.toContain('Cambiar horario')
    expect(html).toContain('24 h antes')
    expect(html).toContain('48 h antes')
    expect(html).toContain('2 h antes')
  })
})
