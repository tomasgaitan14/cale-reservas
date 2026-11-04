export interface PushJob { id: string; lease_id: string; subscription_id: string; endpoint: string; p256dh: string; auth: string; kind: string }
export function allowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.search && !url.hash && ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com'].includes(url.hostname) && url.pathname.length > 1
  } catch { return false }
}
export function pushMessage(job: PushJob) {
  const text = job.kind === 'test' ? 'Los avisos de Cale ya llegan a este dispositivo.' : job.kind === 'cancelled' ? 'Se canceló un turno. Revisá tu agenda.' : 'Tenés una nueva reserva. Revisá tu agenda.'
  return { title: 'Cale', body: text, tag: `cale-${job.id}`, url: '/panel' }
}
export async function deliverJobs(jobs: PushJob[], send: (job: PushJob, payload: string) => Promise<unknown>, finish: (job: PushJob, status: 'sent' | 'expired' | 'retry') => Promise<void>) {
  await Promise.all(jobs.map(async job => {
    if (!allowedPushEndpoint(job.endpoint)) { await finish(job, 'expired'); return }
    let status: 'sent' | 'expired' | 'retry' = 'sent'
    try { await send(job, JSON.stringify(pushMessage(job))) }
    catch (cause) {
      const code = (cause as { statusCode?: number })?.statusCode
      status = code === 404 || code === 410 ? 'expired' : 'retry'
    }
    await finish(job, status)
  }))
}
