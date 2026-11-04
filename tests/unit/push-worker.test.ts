import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
const source = readFileSync('app/public/panel-sw.js','utf8')
describe('título visible del service worker', () => {
  it.each([
    ['Nueva reserva','Nueva reserva'], ['Turno cancelado','Turno cancelado'],
    ['Notificación de prueba','Notificación de prueba'], ['', 'Novedades en tu agenda'],
    ['  ', 'Novedades en tu agenda'], [null,'Novedades en tu agenda'],
  ])('muestra %s con respaldo para títulos vacíos', async (title, expected) => {
    const handlers: Record<string,(event: unknown) => void> = {}
    const show = vi.fn().mockResolvedValue(undefined)
    runInNewContext(source, { self: { addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler }, registration: { showNotification: show } } })
    let completion: Promise<unknown> | undefined
    handlers.push!({ data: { json: () => ({ title, body: 'Mensaje demo' }) }, waitUntil: (promise: Promise<unknown>) => { completion=promise } })
    await completion
    expect(show).toHaveBeenCalledWith(expected, expect.objectContaining({ body: 'Mensaje demo', data: { url: '/panel' } }))
  })
})
