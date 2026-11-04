import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../app/src/lib/supabase.ts', () => ({ supabase: { rpc: vi.fn(() => { throw new Error('direct_rpc_forbidden') }) } }))
import { createBooking } from '../../app/src/lib/booking-api.ts'
const request = { slug: 'demo', serviceId: 'service', date: '2026-11-05', time: '09:00', name: 'Cliente demo', phone: '540000000000', consent: true, token: 'test-token' }
afterEach(() => vi.unstubAllGlobals())
describe('protected booking client', () => {
  it('sin token no envía una reserva', async () => {
    const network = vi.fn(); vi.stubGlobal('fetch', network)
    expect((await createBooking({ ...request, token: '' })).ok).toBe(false)
    expect(network).not.toHaveBeenCalled()
  })
  it('envía el token a la función, sin usar el RPC público', async () => {
    const confirmation = { business_name: 'Demo', service_name: 'Servicio', date: request.date, time: request.time }
    const network = vi.fn().mockResolvedValue(Response.json({ confirmation })); vi.stubGlobal('fetch', network)
    expect(await createBooking(request)).toEqual({ ok: true, confirmation })
    expect(network.mock.calls[0]![0]).toContain('/functions/v1/book-appointment')
    expect(JSON.parse(network.mock.calls[0]![1].body).token).toBe('test-token')
  })
  it('un horario ocupado conserva el error recuperable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'slot_unavailable' }, { status: 400 })))
    const result = await createBooking(request)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.slot).toBeDefined()
  })
  it('una caída de red no comunica una cancelación que no puede comprobar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const result = await createBooking(request)
    if (result.ok) throw new Error('unexpected_success')
    expect(result.errors.general).toContain('Consultá al negocio')
  })
})
