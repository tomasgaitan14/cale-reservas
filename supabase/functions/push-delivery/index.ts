import webpush from 'npm:web-push@3.6.7'
import { deliverJobs } from './handler.ts'
const url = Deno.env.get('SUPABASE_URL') ?? ''
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const jobSecret = Deno.env.get('PUSH_JOB_SECRET') ?? ''
async function rpc(name: string, body: unknown) {
  const result = await fetch(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) })
  if (!result.ok) throw new Error('push_queue_unavailable')
  const text = await result.text()
  return text ? JSON.parse(text) : null
}
Deno.serve(async request => {
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  // Clave exclusiva del job programado; ningún usuario puede disparar el worker.
  if (!jobSecret || request.headers.get('x-push-job-secret') !== jobSecret) return new Response(null, { status: 401 })
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey || !key) return new Response(null, { status: 503 })
  try {
    webpush.setVapidDetails('mailto:cale.turnos@gmail.com', publicKey, privateKey)
    const jobs = await rpc('claim_push_jobs', {})
    await deliverJobs(jobs, (job, payload) => webpush.sendNotification({ endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth } }, payload, { TTL: 3600, timeout: 10000, urgency: 'normal' }),
      async (job, status) => { await rpc('finish_push_job', { p_id: job.id, p_lease_id: job.lease_id, p_status: status }) })
    return Response.json({ processed: jobs.length }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ error: 'push_delivery_unavailable' }, { status: 503 }) }
})
