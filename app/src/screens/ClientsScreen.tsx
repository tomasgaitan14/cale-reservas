import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, MagnifyingGlass, UsersThree } from '@phosphor-icons/react'
import type { Business } from '../lib/business.ts'
import { ClientLoadError, fetchClients, type Client } from '../lib/clients.ts'
import { formatLongDate, localParts } from '../lib/dates.ts'
import { SECONDARY_BUTTON } from '../components/ui.ts'

export function ClientsScreen({ business, onBack }: { business: Business; onBack?: () => void }) {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    setState('loading')
    fetchClients(business.id).then(value => {
      if (!active) return
      setClients(value)
      setSelectedId(value[0]?.id ?? null)
      setState('ready')
    }).catch((cause: unknown) => {
      if (!active) return
      if (!(cause instanceof ClientLoadError)) throw cause
      setState('error')
    })
    return () => { active = false }
  }, [business.id])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-AR')
    if (!normalized) return clients
    return clients.filter(client => [client.name, client.phone ?? '', client.email ?? ''].some(value => value.toLocaleLowerCase('es-AR').includes(normalized)))
  }, [clients, query])
  const selected = clients.find(client => client.id === selectedId) ?? filtered[0] ?? null

  return <section className="panel-editor clients-editor">
    <header className="panel-page-header">
      {onBack && <button type="button" className={SECONDARY_BUTTON} onClick={onBack}><ArrowLeft weight="bold" aria-hidden="true" />Volver a Negocio</button>}
      <p className="eyebrow">Tu negocio</p>
      <h1>Tus clientes</h1>
      <p className="editor-description text-muted">Toda la información de las personas que reservaron en tu negocio, con su historial de turnos.</p>
    </header>
    {state === 'loading' ? <div className="skeleton clients-loading" role="status" aria-label="Cargando clientes" /> : state === 'error' ? <div className="clients-empty"><UsersThree size={34} aria-hidden="true" /><h2>No pudimos cargar tus clientes</h2><p>Probá volver a entrar a esta sección en un momento.</p></div> : clients.length === 0 ? <div className="clients-empty"><UsersThree size={34} aria-hidden="true" /><h2>Todavía no tenés clientes</h2><p>Cuando alguien reserve un turno, sus datos van a aparecer acá automáticamente.</p></div> : <div className="clients-layout">
      <div className="clients-list-panel">
        <label className="clients-search"><MagnifyingGlass size={20} aria-hidden="true" /><span className="sr-only">Buscar clientes</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre o celular" /></label>
        <p className="clients-count">{filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'}</p>
        {filtered.length === 0 ? <p className="clients-no-results">No encontramos clientes con esa búsqueda.</p> : <div className="clients-list">{filtered.map(client => <button type="button" key={client.id} className="client-list-item" aria-pressed={selected?.id === client.id} onClick={() => setSelectedId(client.id)}><span className="client-avatar" aria-hidden="true">{client.name.charAt(0).toUpperCase()}</span><span className="client-list-copy"><strong>{client.name}</strong><span>{client.phone ? `+${client.phone}` : 'Sin celular'} · {client.appointments.length} {client.appointments.length === 1 ? 'turno' : 'turnos'}</span></span></button>)}</div>}
      </div>
      {selected ? <article className="client-detail"><div className="client-detail-heading"><span className="client-avatar client-avatar-large" aria-hidden="true">{selected.name.charAt(0).toUpperCase()}</span><div><p className="eyebrow">Cliente</p><h2>{selected.name}</h2><p className="text-muted">{selected.phone ? `+${selected.phone}` : 'Sin celular registrado'}{selected.email ? ` · ${selected.email}` : ''}</p></div></div><div className="client-detail-summary"><div><span>Turnos</span><strong>{selected.appointments.length}</strong></div><div><span>Última reserva</span><strong>{selected.appointments[0] ? formatLongDate(localParts(selected.appointments[0].starts_at).date) : 'Sin reservas'}</strong></div></div><div><h3>Historial de turnos</h3>{selected.appointments.length === 0 ? <p className="mt-3 text-muted">Todavía no hay turnos asociados.</p> : <ul className="client-history">{selected.appointments.slice(0, 8).map(appointment => <li key={appointment.id}><span><strong>{appointment.service_name}</strong><span>{formatLongDate(localParts(appointment.starts_at).date)}</span></span><small>{appointment.status === 'cancelled' ? 'Cancelado' : 'Reservado'}</small></li>)}</ul>}</div></article> : null}
    </div>}
  </section>
}
