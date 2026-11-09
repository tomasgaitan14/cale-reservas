import { useEffect, useState } from 'react'
import { ArrowRight, Check, CheckCircle, Scissors, WhatsappLogo } from '@phosphor-icons/react'

const SAMPLE_DAYS = [['Mar', '3'], ['Mié', '4'], ['Jue', '5'], ['Vie', '6']] as const
const SAMPLE_TIMES = ['09:00', '10:00', '11:00'] as const
type DemoPhase = 'service' | 'day' | 'time' | 'submit' | 'message' | 'actions' | 'confirmed'

const NEXT_PHASE: Record<DemoPhase, DemoPhase> = {
  service: 'day', day: 'time', time: 'submit', submit: 'message', message: 'actions', actions: 'confirmed', confirmed: 'service',
}
const PHASE_DURATION: Record<DemoPhase, number> = {
  service: 1100, day: 1000, time: 1000, submit: 850, message: 1350, actions: 1850, confirmed: 3000,
}

export function BookingPreview() {
  const [phase, setPhase] = useState<DemoPhase>('service')
  const [day, setDay] = useState('4')
  const [time, setTime] = useState('10:00')

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase(current => NEXT_PHASE[current]), PHASE_DURATION[phase])
    return () => window.clearTimeout(timer)
  }, [phase])

  const onConfirm = () => setPhase('confirmed')
  const bookingVisible = ['service', 'day', 'time', 'submit'].includes(phase)
  const serviceSelected = phase !== 'service'
  const daySelected = ['time', 'submit'].includes(phase)
  const timeSelected = phase === 'submit'

  return <div className={`natural-booking-visual natural-flow-demo is-${phase}`} aria-label="Demostración automática de reserva y recordatorio por WhatsApp">
    {bookingVisible ? <section className="natural-booking-preview natural-flow-booking" aria-label="Demostración visual de reservas">
      <span className="natural-demo-tag">Peluquería Mario · Demo automática</span>
      <h2>Peluquería Mario</h2>
      <p>Tu próximo turno, a un toque.</p>
      <div className={`natural-flow-service ${serviceSelected ? 'is-selected' : 'is-pending'}`}>
        <Scissors size={20} aria-hidden="true" />
        <span><small>Servicio</small><strong>{serviceSelected ? 'Corte de pelo' : 'Elegí un servicio'}</strong></span>
        {serviceSelected && <Check size={18} weight="bold" aria-hidden="true" />}
      </div>
      <p className="natural-preview-label">Noviembre · elegí tu día</p>
      <div className="natural-preview-days">{SAMPLE_DAYS.map(([label,value])=><button key={value} aria-pressed={daySelected && day===value} onClick={() => { setDay(value); setPhase('day') }}><span>{label}</span><strong>{value}</strong></button>)}</div>
      <p className="natural-preview-label">Horarios disponibles</p>
      <div className="natural-preview-times">{SAMPLE_TIMES.map(value=><button key={value} aria-pressed={timeSelected && time===value} onClick={() => { setTime(value); setPhase('time') }}>{value}</button>)}</div>
      <button className={`natural-preview-submit ${timeSelected ? 'is-ready' : ''}`} onClick={() => setPhase('submit')} disabled={!timeSelected}>{timeSelected ? <>Elegir este horario<ArrowRight size={18} aria-hidden="true" /></> : 'Esperando selección…'}</button>
      <p className="natural-preview-note">Esta demostración no crea una reserva.</p>
    </section> : <section className="natural-flow-whatsapp" aria-label="Demostración del recordatorio por WhatsApp">
      <div className="natural-flow-whatsapp-head"><WhatsappLogo size={31} weight="fill" aria-hidden="true" /><span><strong>Peluquería Mario</strong><small>en línea</small></span><span className="natural-flow-menu" aria-hidden="true">⋮</span></div>
      <div className="natural-flow-chat-body">
        <div className="natural-flow-message"><p>Hola, te recordamos tu turno en Peluquería Mario: Corte de pelo, miércoles 4 de noviembre a las 10:00. ¿Nos confirmás si venís?</p><small>09:02 <span aria-hidden="true">✓✓</span></small></div>
        {phase === 'message' && <p className="natural-flow-typing">Peluquería Mario está enviando el recordatorio…</p>}
        {(phase === 'actions' || phase === 'confirmed') && <div className="natural-flow-actions"><button className="natural-flow-confirm" onClick={onConfirm}><Check size={19} weight="bold" />Confirmo</button><button className="natural-flow-cancel" onClick={() => setPhase('confirmed')}>Cancelo</button></div>}
        {phase === 'confirmed' && <p role="status" className="natural-flow-confirmed"><CheckCircle size={22} weight="fill" />Turno confirmado <small>09:03 ✓✓</small></p>}
      </div>
    </section>}
  </div>
}
