import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../app/src/lib/supabase.ts', () => ({ supabase: {} }))
import { BusinessScreen } from '../../app/src/screens/BusinessScreen.tsx'
import { RemindersScreen } from '../../app/src/screens/RemindersScreen.tsx'
const business = { id: 'business-demo', name: 'Negocio demo', slug: 'negocio-demo', whatsapp: '540000000000' }
afterEach(() => vi.unstubAllGlobals())
describe('contenido y honestidad del panel', () => {
  it('no expone un link ni QR antes de tener servicio y horarios', () => {
    const html = renderToStaticMarkup(createElement(BusinessScreen, { business, ready: false, onChanged: vi.fn(), onServices: vi.fn(), onHours: vi.fn() }))
    expect(html).toContain('cuando tengas al menos un servicio activo y horarios')
    expect(html).toContain('Página y colores')
    expect(html).toContain('Editar página')
    expect(html).not.toContain('Copiar link')
    expect(html).not.toContain('Guardar QR')
  })
  it('el link y el mensaje usan la dirección del entorno donde está abierto el panel', () => {
    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:5174' } })
    const html = renderToStaticMarkup(createElement(BusinessScreen, { business, ready: true, onChanged: vi.fn(), onServices: vi.fn(), onHours: vi.fn() }))
    expect(html).toContain('http://127.0.0.1:5174/negocio-demo')
    expect(html).toContain('Copiar mensaje')
    expect(html).not.toContain('https://cale.com.ar/negocio-demo')
  })
  it('mantiene WhatsApp como próximamente para Gratis y Pro', () => {
    const gratisHtml = renderToStaticMarkup(createElement(RemindersScreen, { business: { ...business, plan: 'gratis' } }))
    const proHtml = renderToStaticMarkup(createElement(RemindersScreen, { business: { ...business, plan: 'pro' } }))
    expect(gratisHtml).toContain('WhatsApp · Próximamente')
    expect(proHtml).toContain('WhatsApp · Próximamente')
    expect(gratisHtml).not.toContain('Pasar a Pro')
    expect(proHtml).not.toContain('Guardar preferencias')
    const html = proHtml
    expect(html).toContain('Ejemplo de recordatorio, no enviado')
    expect(html).toContain('Confirmo')
    expect(html).toContain('Cancelo')
    expect(html).not.toContain('Cambiar horario')
    expect(html).not.toContain('24 h antes')
    expect(html).not.toContain('Los recordatorios por WhatsApp están disponibles en un plan pago')
    expect(html).toContain('Todavía no se envían mensajes')
  })
})
