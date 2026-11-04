import { describe, expect, it, vi } from 'vitest'
import { allowedPushEndpoint, deliverJobs, pushMessage, type PushJob } from '../../supabase/functions/push-delivery/handler.ts'
const job: PushJob = { id: 'job', lease_id: 'lease', subscription_id: 'subscription', endpoint: 'https://web.push.apple.com/opaque-token', p256dh: 'key', auth: 'key', kind: 'new_booking' }
describe('entrega push', () => {
  it.each(['http://web.push.apple.com/x','https://evil.invalid/x','https://web.push.apple.com.evil.invalid/x','https://web.push.apple.com:444/x','https://user@web.push.apple.com/x','https://web.push.apple.com/x?token=1'])('rechaza un endpoint no permitido: %s', endpoint => { expect(allowedPushEndpoint(endpoint)).toBe(false) })
  it('notifica sin datos personales y siempre abre el panel', () => {
    expect(pushMessage(job)).toEqual({ title: 'Nueva reserva', body: 'Tenés una nueva reserva. Revisá tu agenda.', tag: 'cale-job', url: '/panel' })
  })
  it.each([['new_booking','Nueva reserva'],['cancelled','Turno cancelado'],['test','Notificación de prueba']])('usa el título de %s', (kind, title) => { expect(pushMessage({ ...job, kind }).title).toBe(title) })
  it('confirma solo después de enviar', async () => {
    const calls: string[] = []
    await deliverJobs([job], async () => { calls.push('send') }, async (_, status) => { calls.push(status) })
    expect(calls).toEqual(['send','sent'])
  })
  it.each([404,410])('elimina una suscripción vencida (%s)', async statusCode => {
    const finish = vi.fn()
    await deliverJobs([job], async () => { throw { statusCode } }, finish)
    expect(finish).toHaveBeenCalledWith(job,'expired')
  })
  it('reintenta un fallo transitorio sin marcar entrega', async () => {
    const finish = vi.fn()
    await deliverJobs([job], async () => { throw { statusCode: 503 } }, finish)
    expect(finish).toHaveBeenCalledWith(job,'retry')
  })
  it('no envía a un destino manipulado aunque llegara a la cola', async () => {
    const send = vi.fn(); const finish = vi.fn()
    await deliverJobs([{ ...job, endpoint: 'https://127.0.0.1/internal' }],send,finish)
    expect(send).not.toHaveBeenCalled()
    expect(finish).toHaveBeenCalledWith(expect.anything(),'expired')
  })
})
