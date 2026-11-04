import { useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarBlank, CheckCircle } from '@phosphor-icons/react'
import { DEMO_SERVICES } from './model.ts'

const DEMO_DAYS = [['Mar', '3'], ['Mié', '4'], ['Jue', '5'], ['Vie', '6']] as const
const DEMO_TIMES = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] as const
export function BookingDemo({ compact = false }: { compact?: boolean }) {
  const [step, setStep] = useState(1)
  const [service, setService] = useState<string>(DEMO_SERVICES[1])
  const [day, setDay] = useState('4')
  const [time, setTime] = useState('10:00')
  const [name, setName] = useState('')
  const [done, setDone] = useState(false)
  if (done) return <section className="dv-booking dv-success" aria-live="polite">
    <CheckCircle size={44} weight="regular" /><p className="dv-kicker">Reserva de demostración</p><h2>Así de simple.</h2>
    <p>{name || 'Cliente demo'}, este sería tu turno de {service.toLowerCase()} el {day} de noviembre a las {time}.</p>
    <p className="dv-small">No se guardaron datos ni se creó una reserva real.</p>
    <button className="dv-button" onClick={() => { setDone(false); setStep(1); setName('') }}>Volver a probar</button>
  </section>
  return <section className={`dv-booking ${compact ? 'dv-booking-compact' : ''}`} aria-label="Reserva de demostración">
    <div className="dv-booking-heading"><span className="dv-demo-tag">Demostración</span><h2>Negocio demo</h2><p>Tu próximo turno, a un toque.</p></div>
    {!compact && <ol className="dv-booking-steps" aria-label="Pasos de la reserva">{['Servicio', 'Día y hora', 'Tus datos'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>}
    {(compact || step === 1) && <label className="dv-field"><span>¿Qué servicio necesitás?</span><select value={service} onChange={event => setService(event.target.value)}>{DEMO_SERVICES.map(item => <option key={item} value={item}>{item} · 60 min</option>)}</select></label>}
    {(compact || step === 2) && <div className="dv-booking-schedule"><p className="dv-subheading"><CalendarBlank size={19} />Noviembre · elegí tu día</p><div className="dv-demo-days">{DEMO_DAYS.map(([label, value]) => <button type="button" key={value} aria-pressed={day === value} onClick={() => setDay(value)}><span>{label}</span><strong>{value}</strong></button>)}</div><p className="dv-subheading">Horarios disponibles</p><div className="dv-demo-times">{(compact ? DEMO_TIMES.slice(0,3) : DEMO_TIMES).map(item => <button key={item} type="button" aria-pressed={time === item} onClick={() => setTime(item)}>{item}</button>)}</div></div>}
    {!compact && step === 3 ? <form onSubmit={event => { event.preventDefault(); setDone(true) }} className="dv-booking-details">
      <p className="dv-summary">{service} · {day} de noviembre · {time}</p>
      <label className="dv-field"><span>Tu nombre de ejemplo</span><input value={name} onChange={event => setName(event.target.value)} placeholder="Cliente demo" maxLength={80} required /></label>
      <p className="dv-small">Es una maqueta: no necesitamos tu celular ni se envía información.</p>
      <button type="submit" className="dv-button">Probar reserva<ArrowRight size={18} /></button>
    </form> : <button className="dv-button dv-booking-next" onClick={() => { if (compact) setDone(true); else setStep(value => value + 1) }}>{compact ? 'Elegir este horario' : 'Continuar'}<ArrowRight size={18} /></button>}
    {!compact && step > 1 && <button className="dv-text-button" onClick={() => setStep(value => value - 1)}><ArrowLeft size={17} />Volver</button>}
    {compact && <p className="dv-small">Ejemplo interactivo. No crea una reserva real.</p>}
  </section>
}
