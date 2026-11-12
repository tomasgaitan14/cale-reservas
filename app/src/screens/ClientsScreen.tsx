import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, MagnifyingGlass, UsersThree } from '@phosphor-icons/react'
import type { Business } from '../lib/business.ts'
import { ClientLoadError, ClientMutationError, deleteClient, fetchClients, updateClient, type Client } from '../lib/clients.ts'
import { formatLongDate, localParts } from '../lib/dates.ts'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'

export function ClientsScreen({ business, onBack }: { business: Business; onBack?: () => void }) {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

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

  useEffect(() => {
    if (!selected) return
    setName(selected.name)
    setPhone(selected.phone ?? '')
    setEmail(selected.email ?? '')
    setNotes(selected.notes ?? '')
    setEditing(false)
    setMutationError('')
  }, [selected?.id])

  async function saveSelected() {
    if (!selected || !name.trim()) return
    setSaving(true); setMutationError('')
    try {
      const updated = await updateClient(business.id, selected.id, { name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, notes: notes.trim() || null })
      setClients(current => current.map(client => client.id === selected.id ? { ...client, ...updated } : client))
      setEditing(false)
    } catch (cause) {
      if (!(cause instanceof ClientMutationError)) throw cause
      setMutationError(cause.message)
    } finally { setSaving(false) }
  }

  async function removeSelected() {
    if (!selected || !window.confirm(`¿Eliminar a ${selected.name}? Sus turnos históricos se conservarán, pero quedarán sin cliente asociado.`)) return
    setDeleting(true); setMutationError('')
    try {
      await deleteClient(business.id, selected.id)
      const remaining = clients.filter(client => client.id !== selected.id)
      setClients(remaining)
      setSelectedId(remaining[0]?.id ?? null)
      setEditing(false)
    } catch (cause) {
      if (!(cause instanceof ClientMutationError)) throw cause
      setMutationError(cause.message)
    } finally { setDeleting(false) }
  }

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
      {selected ? <article className="client-detail"><div className="client-detail-heading"><span className="client-avatar client-avatar-large" aria-hidden="true">{selected.name.charAt(0).toUpperCase()}</span><div><p className="eyebrow">Cliente</p><h2>{selected.name}</h2><p className="text-muted">{selected.phone ? `+${selected.phone}` : 'Sin celular registrado'}{selected.email ? ` · ${selected.email}` : ''}</p></div></div><div className="client-detail-summary"><div><span>Turnos</span><strong>{selected.appointments.length}</strong></div><div><span>Última reserva</span><strong>{selected.appointments[0] ? formatLongDate(localParts(selected.appointments[0].starts_at).date) : 'Sin reservas'}</strong></div></div><div className="client-detail-actions"><button type="button" className={SECONDARY_BUTTON} onClick={() => setEditing(value => !value)}>{editing ? 'Cancelar edición' : 'Editar cliente'}</button><button type="button" className="client-delete-button" onClick={() => void removeSelected()} disabled={deleting}>{deleting ? 'Eliminando…' : 'Eliminar cliente'}</button></div>{editing ? <div className="client-edit-form"><label><span>Nombre</span><input value={name} onChange={event => setName(event.target.value)} /></label><label><span>Celular</span><input value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" /></label><label><span>Email</span><input value={email} onChange={event => setEmail(event.target.value)} type="email" /></label><label><span>Notas</span><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={4} placeholder="Preferencias, información útil o notas internas" /></label><button type="button" className={`${PRIMARY_BUTTON} sm:w-auto`} onClick={() => void saveSelected()} disabled={saving || !name.trim()}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div> : null}{mutationError ? <p role="alert" className="text-warn">{mutationError}</p> : null}<div><h3>Notas</h3>{selected.notes ? <p className="client-notes">{selected.notes}</p> : <p className="mt-3 text-muted">Todavía no hay notas para este cliente.</p>}</div><div><h3>Historial de turnos</h3>{selected.appointments.length === 0 ? <p className="mt-3 text-muted">Todavía no hay turnos asociados.</p> : <ul className="client-history">{selected.appointments.slice(0, 8).map(appointment => <li key={appointment.id}><span><strong>{appointment.service_name}</strong><span>{formatLongDate(localParts(appointment.starts_at).date)}</span></span><small>{appointment.status === 'cancelled' ? 'Cancelado' : 'Reservado'}</small></li>)}</ul>}</div></article> : null}
    </div>}
  </section>
}
