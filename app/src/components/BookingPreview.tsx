import { useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
const SAMPLE_DAYS = [['Mar', '3'], ['Mié', '4'], ['Jue', '5'], ['Vie', '6']] as const
const SAMPLE_TIMES = ['09:00', '10:00', '11:00'] as const
export function BookingPreview() {
  const [day,setDay] = useState('4')
  const [time,setTime] = useState('10:00')
  const [service,setService] = useState('Limpieza facial')
  const [selected,setSelected] = useState(false)
  return <div className="natural-booking-visual">
    <section className="natural-booking-preview" aria-label="Demostración visual de reservas">
      <span className="natural-demo-tag">Vista de demostración</span><h2>Negocio demo</h2><p>Tu próximo turno, a un toque.</p>
      <label className="natural-preview-field"><span>¿Qué servicio necesitás?</span><select value={service} onChange={event=>{setService(event.target.value);setSelected(false)}}><option>Limpieza facial</option><option>Corte de pelo</option></select></label>
      <p className="natural-preview-label">Noviembre · elegí tu día</p>
      <div className="natural-preview-days">{SAMPLE_DAYS.map(([label,value])=><button key={value} aria-pressed={day===value} onClick={()=>{setDay(value);setSelected(false)}}><span>{label}</span><strong>{value}</strong></button>)}</div>
      <p className="natural-preview-label">Horarios disponibles</p>
      <div className="natural-preview-times">{SAMPLE_TIMES.map(value=><button key={value} aria-pressed={time===value} onClick={()=>{setTime(value);setSelected(false)}}>{value}</button>)}</div>
      <button className="natural-preview-submit" onClick={()=>setSelected(true)}>Elegir este horario<ArrowRight size={18} aria-hidden="true"/></button>
      {selected&&<p role="status" className="text-link">Ejemplo: {service}, {day} de noviembre a las {time}.</p>}
      <p className="natural-preview-note">Esta demostración no crea una reserva.</p>
    </section>
    <svg className="natural-preview-plant" viewBox="0 0 150 240" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M71 224C76 156 87 89 109 17M87 127C49 125 33 102 29 79 64 81 88 99 87 127ZM95 92C126 82 137 60 135 40 113 48 100 66 95 92ZM78 172C40 174 18 159 10 139 41 134 68 145 78 172ZM104 52C85 36 85 16 93 4 107 19 113 35 104 52ZM83 151C122 146 137 126 141 105 110 109 91 126 83 151Z"/></svg>
  </div>
}
