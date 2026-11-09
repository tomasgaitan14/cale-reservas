import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Crown, X } from '@phosphor-icons/react'
import type { Business } from '../lib/business.ts'
import { startProSubscription } from '../lib/billing.ts'
import { PRIMARY_BUTTON } from './ui.ts'

const FIRST_DELAY = 3 * 60 * 1000
const REPEAT_DELAY = 10 * 60 * 1000
const DISPLAY_TIME = 9 * 1000
const TICK = 100

const MESSAGES = [
  { title: 'Menos olvidos, más turnos confirmados.', text: 'Imaginá contar con recordatorios automáticos para que tus clientes no se pierdan sus próximos turnos.' },
  { title: 'Tu agenda puede trabajar por vos.', text: 'Con Pro, tus clientes reciben avisos antes de su turno y llegan mejor preparados.' },
  { title: 'Dale un seguimiento extra a cada reserva.', text: 'Pasate a Pro y sumá recordatorios por WhatsApp a la experiencia de tu negocio.' },
] as const

export function ProNudge({ business, tab }: { business: Business; tab: string }) {
  const [visible, setVisible] = useState(false)
  const [messageIndex, setMessageIndex] = useState(0)
  const [progress, setProgress] = useState(100)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)
  const scheduleRef = useRef<(delay: number) => void>(() => undefined)

  useEffect(() => {
    if (business.plan === 'pro' || tab === 'reminders') return
    const schedule = (delay: number) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        setVisible(true)
        setProgress(100)
        interval.current = setInterval(() => setProgress(value => Math.max(0, value - (TICK / DISPLAY_TIME) * 100)), TICK)
        timer.current = setTimeout(() => {
          setVisible(false)
          if (interval.current) clearInterval(interval.current)
          setMessageIndex(value => (value + 1) % MESSAGES.length)
          schedule(REPEAT_DELAY)
        }, DISPLAY_TIME)
      }, delay)
    }
    scheduleRef.current = schedule
    schedule(FIRST_DELAY)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      if (interval.current) clearInterval(interval.current)
      scheduleRef.current = () => undefined
    }
  }, [business.plan, tab])

  function dismiss() {
    setVisible(false)
    if (timer.current) clearTimeout(timer.current)
    if (interval.current) clearInterval(interval.current)
    setMessageIndex(value => (value + 1) % MESSAGES.length)
    scheduleRef.current(REPEAT_DELAY)
  }

  async function upgrade() {
    setBusy(true); setError('')
    try { window.location.assign(await startProSubscription(business.id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos iniciar la suscripción. Probá nuevamente.'); setBusy(false) }
  }

  if (business.plan === 'pro' || tab === 'reminders' || !visible) return null
  const message = MESSAGES[messageIndex] ?? MESSAGES[0]!
  return <aside className="pro-nudge" aria-live="polite">
    <div className="pro-nudge-header"><span className="pro-nudge-icon"><Crown size={19} weight="bold" aria-hidden="true" /></span><p className="pro-nudge-label">Cale Pro</p><button type="button" className="pro-nudge-close" aria-label="Cerrar aviso" onClick={dismiss}><X size={18} aria-hidden="true" /></button></div>
    <h2>{message.title}</h2>
    <p>{message.text}</p>
    {error && <p role="alert" className="pro-nudge-error">{error}</p>}
    <button type="button" className={`${PRIMARY_BUTTON} pro-nudge-action`} disabled={busy} onClick={() => void upgrade()}>{busy ? 'Preparando pago…' : 'Pasar a Pro'}{!busy && <ArrowRight size={18} aria-hidden="true" />}</button>
    <div className="pro-nudge-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
  </aside>
}
