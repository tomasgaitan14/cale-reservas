import { describe, expect, it, vi } from 'vitest'
import { bookingHandler } from '../../supabase/functions/book-appointment/handler.ts'
const config = { origins: ['https://app.cale.com.ar'], hostnames: ['app.cale.com.ar'], secret: 'test-secret', supabaseUrl: 'https://example.invalid', serverKey: 'test-server-key' }
const payload = { slug: 'negocio-demo', serviceId: '00000000-0000-4000-8000-000000000001', date: '2026-11-05', time: '09:00', name: ' Cliente demo ', phone: '540000000000', consent: true, token: 'test-token' }
const request = (body: unknown = payload, origin = 'https://app.cale.com.ar') => new Request('https://example.invalid', { method: 'POST', headers: { origin }, body: JSON.stringify(body) })
describe('booking gateway', () => {
  it.each([
    { success: false },
    { success: true, hostname: 'foreign.invalid', action: 'booking' },
    { success: true, hostname: 'app.cale.com.ar', action: 'login' },
  ])('rechaza verificación inválida antes de crear el turno: %j', async result => {
    const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json(result))
    const response = await bookingHandler(config, network)(request())
    expect(response.status).toBe(400)
    expect(network).toHaveBeenCalledTimes(1)
  })
  it('solo reserva después de validar el token y limpia el nombre', async () => {
    const network = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ success: true, hostname: 'app.cale.com.ar', action: 'booking' })).mockResolvedValueOnce(Response.json({ service_name: 'Corte' }))
    const response = await bookingHandler(config, network)(request())
    expect(response.status).toBe(200)
    expect(network).toHaveBeenCalledTimes(2)
    expect(JSON.parse(network.mock.calls[1]![1]!.body as string).p_client_name).toBe('Cliente demo')
    expect(await response.json()).toEqual({ confirmation: { service_name: 'Corte' } })
  })
  it('falla cerrado si Cloudflare no responde', async () => {
    const network = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))
    expect((await bookingHandler(config, network)(request())).status).toBe(503)
    expect(network).toHaveBeenCalledTimes(1)
  })
  it.each([{ ...payload, consent: false }, { ...payload, token: '' }, { ...payload, phone: 'invalid' }])('rechaza datos inválidos sin llamadas externas', async body => {
    const network = vi.fn<typeof fetch>()
    expect((await bookingHandler(config, network)(request(body))).status).toBe(400)
    expect(network).not.toHaveBeenCalled()
  })
  it('rechaza otro origen sin llamadas externas', async () => {
    const network = vi.fn<typeof fetch>()
    expect((await bookingHandler(config, network)(request(payload, 'https://foreign.invalid'))).status).toBe(403)
    expect(network).not.toHaveBeenCalled()
  })
  it('no expone errores internos de la base', async () => {
    const network = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ success: true, hostname: 'app.cale.com.ar', action: 'booking' })).mockResolvedValueOnce(Response.json({ message: 'private-detail' }, { status: 500 }))
    expect(await (await bookingHandler(config, network)(request())).json()).toEqual({ error: 'booking_failed' })
  })
})
