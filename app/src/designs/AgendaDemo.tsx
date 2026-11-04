import { Fragment, useState, type FormEvent } from 'react'
import { ArrowUpRight, CalendarBlank, CaretLeft, CaretRight, Clock, Copy, MagnifyingGlass, Plus, QrCode, ProhibitInset } from '@phosphor-icons/react'
import { Modal } from '../components/Modal.tsx'
import { DEMO_APPOINTMENTS, DEMO_SERVICES, endTime, type DemoAppointment, type DesignVariant } from './model.ts'

interface AgendaProps { variant: DesignVariant; onReserve: () => void; onQr: () => void }
export function AgendaDemo({ variant, onReserve, onQr }: AgendaProps) {
  const [appointments, setAppointments] = useState<DemoAppointment[]>([...DEMO_APPOINTMENTS])
  const [selected, setSelected] = useState<DemoAppointment | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('Cliente demo')
  const [service, setService] = useState<string>(DEMO_SERVICES[0])
  const [filter, setFilter] = useState('')
  const [view, setView] = useState<'today' | 'tomorrow'>('today')
  const [notice, setNotice] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [newError, setNewError] = useState('')
  const dayAppointments = view === 'today' ? appointments : appointments.slice(0,3)
  const visible = dayAppointments.filter(item => `${item.client} ${item.service} ${item.time}`.toLowerCase().includes(filter.toLowerCase()))
  async function copy() {
    try { await navigator.clipboard.writeText('https://cale.com.ar/negocio-demo'); setNotice('Link de ejemplo copiado. No corresponde a un negocio real.') }
    catch { setNotice('Podés copiar el link de ejemplo que aparece en pantalla.') }
  }
  function add(event: FormEvent) {
    event.preventDefault()
    if (appointments.some(item => item.time === '17:00')) { setNewError('El turno de ejemplo de las 17:00 ya está ocupado.'); return }
    setAppointments(current => [...current, { id: 'demo-new', time: '17:00', duration:60, service, client:name.trim(), status:'pending' }])
    setCreating(false); setNotice('Turno agregado solo a esta demostración. No se guardó en Cale.')
  }
  const sharing = <section className="dv-sharing"><p className="dv-kicker">Tu página de reservas</p><h2>Un link.<br />Más simple para todos.</h2><p>Compartí tu link y dejá que tus clientes elijan su turno.</p><span className="dv-sharing-url">cale.com.ar/negocio-demo</span><div className="dv-sharing-actions"><button className="dv-button dv-secondary" onClick={() => void copy()}><Copy size={18} />Copiar link</button><button className="dv-button dv-secondary" onClick={onQr}><QrCode size={18} />Ver QR</button></div><button className="dv-text-button" onClick={onReserve}>Ver página de ejemplo<ArrowUpRight size={17} /></button></section>
  const rows = <div className="dv-appointment-list">
    {variant === 'clara' && <div className="dv-list-labels"><span>Hora</span><span>Cliente y servicio</span><span>Estado</span><span>Acción</span></div>}
    {visible.map((item,index) => <Fragment key={item.id}>{item.time >= '12:00' && (index === 0 || visible[index-1]!.time < '12:00') && <div className="dv-break"><span>12:00 — 13:00</span><strong>Descanso</strong></div>}<button className={`dv-appointment-row ${item.status}`} onClick={() => setSelected(item)}><time>{item.time}</time><span className="dv-client-service"><strong>{item.client}</strong><span>{item.service}</span></span><span className={`dv-status ${item.status}`}>{item.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}</span><ArrowUpRight className="dv-row-arrow" size={18} /></button></Fragment>)}
    {visible.length === 0 && <p className="dv-empty">No hay turnos que coincidan con tu búsqueda.</p>}
    {!visible.some(item => item.time >= '12:00') && <div className="dv-break"><span>12:00 — 13:00</span><strong>Descanso</strong></div>}
  </div>
  return <div className="dv-dashboard-content">
    {variant === 'clara' && <div className="dv-workspace-tools"><label className="dv-search"><MagnifyingGlass size={19} /><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Buscar en la agenda" aria-label="Buscar en la agenda" /></label><span>Negocio demo</span></div>}
    <div className="dv-agenda-heading"><div><p className="dv-kicker">Martes, 3 de noviembre</p><h1>Tu día, en orden.</h1><p>Todo lo que necesitás para atender, en un lugar.</p></div><div className="dv-top-actions"><button className="dv-button" onClick={() => { setCreating(true); setNewError('') }}><Plus size={19} />Nuevo turno</button><button className="dv-button dv-secondary" aria-pressed={blocked} onClick={() => { setBlocked(current => !current); setNotice(blocked ? 'Bloqueo de ejemplo quitado.' : 'Bloqueo de ejemplo agregado de 18:00 a 19:00. No se guardó en Cale.') }}><ProhibitInset size={19} />{blocked ? 'Quitar bloqueo' : 'Bloquear horario'}</button></div></div>
    <div className="dv-agenda-counts"><span>Hoy <strong>{appointments.length} turnos</strong></span><span>Mañana <strong>3 turnos</strong></span><span className="dv-demo-tag">Datos de demostración</span></div>
    {notice && <p role="status" className="dv-notice">{notice}</p>}
    <div className="dv-agenda-layout">
      {variant === 'editorial' && <aside className="dv-date-rail"><span>{view === 'today' ? 'Martes' : 'Miércoles'}</span><strong>{view === 'today' ? '03' : '04'}</strong><span>Noviembre</span><div><button aria-label="Ver hoy" onClick={() => setView('today')}><CaretLeft size={19} /></button><button aria-label="Ver mañana" onClick={() => setView('tomorrow')}><CaretRight size={19} /></button></div></aside>}
      <section className="dv-agenda-sheet" aria-label="Agenda de demostración"><div className="dv-agenda-toolbar"><span><CalendarBlank size={20} />{view === 'today' ? '3 de noviembre' : '4 de noviembre'}</span><div className="dv-segment"><button aria-pressed={view === 'today'} onClick={() => setView('today')}>Hoy</button><button aria-pressed={view === 'tomorrow'} onClick={() => setView('tomorrow')}>Mañana</button></div></div>
        {variant === 'natural' ? <div className="dv-timeline">{Array.from({length:10},(_,index) => <div className="dv-hour" key={index} style={{top:`${index * 46}px`}}><span>{String(index+9).padStart(2,'0')}:00</span><i /></div>)}<div className="dv-timeline-break" style={{top:138,height:46}}>Descanso <span>12:00 — 13:00</span></div>{visible.map(item => { const [h,m]=item.time.split(':').map(Number); return <button key={item.id} className={`dv-timeline-event ${item.status}`} style={{top:((h??9)-9)*46+(m??0)*46/60,height:item.duration*46/60}} onClick={() => setSelected(item)}><span><strong>{item.client} · {item.service}</strong><small>{item.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}</small></span><time>{item.time} — {endTime(item.time,item.duration)}</time></button> })}</div> : rows}
        {blocked && <p className="dv-extra-block">18:00 — 19:00 · Horario bloqueado de ejemplo</p>}
      </section>
      <aside className="dv-agenda-aside">{sharing}<p className="dv-coming"><Clock size={24} /><span><strong>WhatsApp, en preparación</strong><span>Tus reservas ya funcionan. Los recordatorios llegan después.</span></span></p></aside>
    </div>
    {creating && <Modal title="Nuevo turno de ejemplo" onClose={() => setCreating(false)}><form className="dv-modal-form" onSubmit={add}><p>Lo vas a ver en esta maqueta. No se guarda en la base.</p><label className="dv-field"><span>Nombre de ejemplo</span><input value={name} onChange={event => setName(event.target.value)} required maxLength={80} /></label><label className="dv-field"><span>Servicio</span><select value={service} onChange={event => setService(event.target.value)}>{DEMO_SERVICES.map(item => <option key={item}>{item}</option>)}</select></label><p className="dv-summary">3 de noviembre · 17:00 · 60 min</p>{newError && <p role="alert">{newError}</p>}<button className="dv-button" type="submit">Agregar a la demostración</button></form></Modal>}
    {selected && <Modal title="Turno de demostración" onClose={() => setSelected(null)}><div className="dv-modal-form"><p><strong>{selected.service}</strong></p><p>{selected.client} · {selected.time} — {endTime(selected.time,selected.duration)}</p><p>{selected.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}</p><button className="dv-button dv-secondary" onClick={() => { setAppointments(current => current.filter(item => item.id !== selected.id)); setSelected(null); setNotice('Turno quitado de esta demostración.') }}>Quitar turno de ejemplo</button></div></Modal>}
  </div>
}
