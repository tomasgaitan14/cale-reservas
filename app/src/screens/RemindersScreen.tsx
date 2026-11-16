import { useEffect, useState } from 'react'
import type { Business } from '../lib/business.ts'
import { supabase } from '../lib/supabase.ts'
import { SECONDARY_BUTTON } from '../components/ui.ts'

type Delivery = { id: string; scheduled_for: string; status: string; sent_at: string | null; delivered_at: string | null; read_at: string | null; last_error_code: string | null }
const labels: Record<string, string> = { pending: 'Programado', processing: 'Procesando envío', sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'No se pudo enviar', cancelled: 'Cancelado' }
const date = (value: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Cordoba' }).format(new Date(value))

export function RemindersScreen({ business }: { business: Business }) {
  const [rows, setRows] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    void supabase.from('reminder_deliveries').select('id, scheduled_for, status, sent_at, delivered_at, read_at, last_error_code').eq('business_id', business.id).order('scheduled_for', { ascending: false }).limit(50).then(({ data, error }) => {
      if (active) { setRows(data ?? []); setError(Boolean(error)); setLoading(false) }
    })
    return () => { active = false }
  }, [business.id, refresh])
  return <section className="max-w-5xl flex flex-col gap-6">
    <div><p className="eyebrow">Avisos</p><h1 className="screen-title">Tus recordatorios.</h1><p className="mt-4 text-muted">Últimos 50 recordatorios y estados informados por WhatsApp.</p></div>
    <button className={SECONDARY_BUTTON} onClick={() => setRefresh(value => value + 1)} disabled={loading}>{loading ? 'Consultando…' : 'Actualizar estados'}</button>
    {error ? <p role="alert">No pudimos consultar el historial. Probá actualizar.</p> : loading ? <p role="status">Cargando historial…</p> : rows.length === 0 ? <div className="rounded-2xl border border-line bg-surface p-6"><h2>Todavía no hay recordatorios</h2><p className="mt-3 text-muted">Cuando se active el envío para tu negocio, aparecerán aquí. Coordiná la conexión desde Ajustes → WhatsApp del negocio.</p></div> : <ul className="flex flex-col gap-4">{rows.map(row => <li key={row.id} className="rounded-2xl border border-line bg-surface p-5 flex flex-col gap-2">
      <strong>{labels[row.status] ?? row.status}</strong><p>Programado: {date(row.scheduled_for)}</p>
      {row.sent_at && <p>Enviado: {date(row.sent_at)}</p>}
      {row.delivered_at && <p>Entregado: {date(row.delivered_at)}</p>}
      {row.read_at && <p>Leído: {date(row.read_at)}</p>}
      {row.status === 'failed' && <p className="text-warn">Contactá al equipo de Cale para revisar el envío{row.last_error_code ? ' (código ' + row.last_error_code + ')' : ''}.</p>}
    </li>)}</ul>}
  </section>
}
