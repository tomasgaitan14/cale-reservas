import { DEFAULT_BRANDING, brandingStyle } from '../lib/branding.ts'
import { logoUrl } from '../lib/branding-api.ts'
import { Turnstile } from '../components/booking/Turnstile.tsx'
import { CheckCircle } from '@phosphor-icons/react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { DatePicker } from '../components/booking/DatePicker.tsx'
import { DetailsForm, type BookingDetails, type BookingDraft } from '../components/booking/DetailsForm.tsx'
import { ServicePicker } from '../components/booking/ServicePicker.tsx'
import { TimePicker, type SlotsState } from '../components/booking/TimePicker.tsx'
import { Shell } from '../components/Shell.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'
import {
  BookingLoadError,
  createBooking,
  fetchBookingInfo,
  fetchSlots,
  type BookingConfirmation,
  type BookingInfo,
} from '../lib/booking-api.ts'
import type { BookingFormErrors } from '../lib/booking-errors.ts'
import { bookableDates, formatLongDate, todayInArgentina } from '../lib/dates.ts'
import { formatDuration } from '../lib/duration.ts'

type InfoState = { status: 'loading' } | { status: 'error' } | { status: 'not-found' } | { status: 'ready'; info: BookingInfo }

export function BookingPage({ slug }: { slug: string }) {
  const [state, setState] = useState<InfoState>({ status: 'loading' })
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchBookingInfo(slug)
      .then(info => {
        if (cancelled) return
        setState(info ? { status: 'ready', info } : { status: 'not-found' })
        if (info) document.title = `${info.name} · Reservas`
      })
      .catch((error: unknown) => {
        if (!(error instanceof BookingLoadError)) throw error
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [slug, reloadCount])

  return (
    <Shell brand={state.status === 'ready' ? <BookingIdentity name={state.info.name} path={state.info.branding?.logo_path ?? null} /> : undefined}>
      {state.status === 'loading' ? <BookingSkeleton /> : null}
      {state.status === 'not-found' ? (
        <Notice title="No encontramos este negocio" text="Revisá que el link esté bien escrito." />
      ) : null}
      {state.status === 'error' ? (
        <Notice title="No pudimos cargar la página" text="Revisá tu conexión y probá de nuevo.">
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setReloadCount(count => count + 1)}>
            Reintentar
          </button>
        </Notice>
      ) : null}
      {state.status === 'ready' ? <><div className="booking-brand-theme" style={brandingStyle(state.info.branding ?? DEFAULT_BRANDING)}><BookingFlow key={`${slug}:${reloadCount}`} slug={slug} info={state.info} onBookAgain={() => { setReloadCount(count => count + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }} /></div><BookingFooter /></> : null}
    </Shell>
  )
}

function Notice({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex max-w-md flex-col items-start gap-4 pt-10">
      <h1 className="text-[1.875rem]">{title}</h1>
      <p className="text-muted">{text}</p>
      {children}
    </div>
  )
}

function BookingSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-6" role="status" aria-label="Cargando la página de reservas">
      <div className="skeleton h-12 w-2/3 rounded-xl" />
      <div className="skeleton h-16 w-full rounded-[1.25rem]" />
      <div className="skeleton h-16 w-full rounded-[1.25rem]" />
    </div>
  )
}

interface BookingFlowProps {
  slug: string
  info: BookingInfo
  onBookAgain: () => void
}

function BookingFlow({ slug, info, onBookAgain }: BookingFlowProps) {
  const [token, setToken] = useState('')
  const [verificationAttempt, setVerificationAttempt] = useState(0)
  const [draft, setDraft] = useState<BookingDraft>({ name: '', phone: '', consent: false })
  const [stage, setStage] = useState<'service' | 'schedule' | 'details'>('service')
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotsState>({ status: 'loading' })
  const [slotsAttempt, setSlotsAttempt] = useState(0)
  const [errors, setErrors] = useState<BookingFormErrors>({})
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null)

  const service = info.services.find(candidate => candidate.id === serviceId)
  const dates = bookableDates(todayInArgentina(), info.open_days)

  useEffect(() => {
    if (!serviceId || !date) return
    let cancelled = false
    setSlots({ status: 'loading' })
    fetchSlots(slug, serviceId, date)
      .then(times => {
        if (!cancelled) setSlots({ status: 'ready', times })
      })
      .catch((error: unknown) => {
        if (!(error instanceof BookingLoadError)) throw error
        if (!cancelled) setSlots({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [slug, serviceId, date, slotsAttempt])

  function clearError(field: keyof BookingFormErrors) {
    setErrors(current => ({ ...current, [field]: undefined }))
  }

  async function submit(details: BookingDetails) {
    if (!serviceId || !date || !time || !token) return
    setBusy(true)
    setErrors({})
    const result = await createBooking({ slug, serviceId, date, time, ...details, token })
    setToken('')
    setVerificationAttempt(value => value + 1)
    setBusy(false)
    if (result.ok) {
      setConfirmation(result.confirmation)
      return
    }
    setErrors(result.errors)
    // Si el horario se ocupó, se vuelve a buscar la lista para que no se ofrezca más
    if (result.errors.slot) {
      setTime(null)
      setStage('schedule')
      setSlotsAttempt(count => count + 1)
    }
  }

  if (confirmation) return <BookingDone confirmation={confirmation} businessName={info.name} whatsapp={info.whatsapp} onBookAgain={onBookAgain} />

  const bookable = info.services.length > 0 && info.open_days.length > 0

  return <div className="warm-split pt-4 md:pt-10">
    <aside className="flex flex-col gap-6 md:sticky md:top-8">
      <p className="eyebrow">{info.name}</p>
      <h1 className={`screen-title ${serviceId ? 'hidden md:block' : ''}`}>Un turno que te quede bien.</h1>
      <p className={`max-w-sm text-lg text-muted ${serviceId ? 'hidden md:block' : ''}`}>Elegí el servicio, el día y el horario. Son solo unos pasos.</p>
      {serviceId && <dl className="booking-summary flex flex-col gap-4 rounded-2xl bg-tint p-5">
        <SummaryRow label="Servicio" value={service ? `${service.name} · ${formatDuration(service.duration_minutes)}` : null} />
        <SummaryRow label="Día" value={date ? formatLongDate(date) : null} /><SummaryRow label="Hora" value={time} />
      </dl>}
    </aside>
    <div className="warm-form">
      {!bookable ? <p>Este negocio todavía no recibe reservas por acá. Volvé a probar más tarde.</p> : <>
        <ol className="booking-progress" aria-label="Pasos de la reserva">
          {(['service', 'schedule', 'details'] as const).map((item, index) => <li key={item} aria-current={stage === item ? 'step' : undefined}><span>{index + 1}</span>{['Servicio', 'Día y hora', 'Tus datos'][index]}</li>)}
        </ol>
        {stage === 'service' && <Step number={1} title="¿Qué turno necesitás?" index={0}>
          <ServicePicker services={info.services} selectedId={serviceId} onSelect={id => { setServiceId(id); setDate(null); setTime(null); setErrors({}); setStage('schedule') }} />
        </Step>}
        {stage === 'schedule' && <Step number={2} title="¿Cuándo venís?" index={0}>
          <DatePicker dates={dates} selected={date} onSelect={next => { setDate(next); setTime(null); setErrors({}) }} />
          {date && <TimePicker slots={slots} selected={time} onSelect={next => { setTime(next); clearError('slot') }} onRetry={() => setSlotsAttempt(count => count + 1)} />}
          {errors.slot && <p role="alert" className="rounded-xl bg-warn-bg p-3 text-warn">{errors.slot}</p>}
          <div className="flex flex-wrap gap-3"><button className={SECONDARY_BUTTON} onClick={() => setStage('service')}>Atrás</button><button className={`${PRIMARY_BUTTON} flex-1`} disabled={!date || !time} onClick={() => setStage('details')}>Continuar</button></div>
        </Step>}
        {stage === 'details' && serviceId && date && time && <Step number={3} title="Dejanos tus datos" index={0}>
          <DetailsForm verification={<Turnstile key={verificationAttempt} onToken={setToken} />} verificationReady={Boolean(token)} draft={draft} onDraftChange={setDraft} errors={errors} busy={busy} onClearError={clearError} onSubmit={details => void submit(details)} />
          <button className={`${SECONDARY_BUTTON} self-start`} disabled={busy} onClick={() => setStage('schedule')}>Cambiar día u hora</button>
        </Step>}
      </>}
    </div>
  </div>
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[0.9375rem] text-muted">{label}</dt>
      <dd className={`font-head text-lg font-extrabold tracking-tight ${value ? '' : 'text-muted'}`}>{value ?? 'Sin elegir'}</dd>
    </div>
  )
}

function Step({ number, title, index, children }: { number: number; title: string; index: number; children: ReactNode }) {
  return (
    <section className="rise-in flex flex-col gap-4" style={{ '--i': index } as CSSProperties} aria-labelledby={`step-${number}`}>
      <h2 id={`step-${number}`} className="flex items-center gap-3 text-[1.3125rem]">
        <span className="grid size-8 flex-none place-items-center rounded-full bg-ink font-head text-base text-on-ink">{number}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function BookingDone({ confirmation, businessName, whatsapp, onBookAgain }: { confirmation: BookingConfirmation; businessName: string; whatsapp?: string; onBookAgain: () => void }) {
  const contact = whatsapp && /^\d{10,15}$/.test(whatsapp)
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quiero consultar por mi turno de ${confirmation.service_name} del ${formatLongDate(confirmation.date)} a las ${confirmation.time}.`)}`
    : null
  return (
    <div className="rise-in flex max-w-xl flex-col items-start gap-6 pt-6 md:pt-14" role="status">
      <span className="grid size-14 place-items-center rounded-[1rem] bg-ink text-on-ink">
        <CheckCircle weight="bold" className="size-8" aria-hidden="true" />
      </span>
      <h1 className="text-[1.875rem] md:text-[2.5rem]">Tu turno quedó reservado</h1>
      <div className="flex w-full flex-col gap-1 rounded-[1.25rem] bg-tint p-5 text-fg">
        <p className="font-head text-xl font-extrabold tracking-tight">{confirmation.service_name}</p>
        <p className="text-base">
          {formatLongDate(confirmation.date)} a las {confirmation.time}
        </p>
        <p className="text-[0.9375rem] text-muted">{businessName}</p>
      </div>
      <button type="button" className={PRIMARY_BUTTON} onClick={onBookAgain}>Reservar otro turno</button>
      <p className="text-sm text-muted">Tu turno actual sigue reservado. Podés pedir otro para este negocio.</p>
      <p className="text-muted">Si necesitás cambiar o cancelar tu turno, contactá al negocio. Los recordatorios automáticos por WhatsApp estarán disponibles próximamente.</p>
      {contact && <><a className={SECONDARY_BUTTON} href={contact} target="_blank" rel="noopener noreferrer">Contactar al negocio<span className="sr-only"> (abre WhatsApp)</span></a><p className="text-sm text-muted">Abrir WhatsApp no cambia ni cancela tu reserva. Coordiná el cambio con el negocio.</p></>}
    </div>
  )
}

function BookingFooter() {
  return <footer className="booking-promo" aria-label="Conocé Cale">
    <div className="flex min-w-0 flex-col items-start gap-3">
      <h2 className="text-xl">¿Tenés un negocio con turnos?</h2>
      <p className="max-w-md text-muted">Tu agenda y tu propio link de reservas, en un mismo lugar. Empezá Gratis y usala sin vencimiento.</p>
    </div>
    <a className={`${SECONDARY_BUTTON} shrink-0`} href="https://cale.com.ar/empezar" target="_blank" rel="noopener noreferrer">Empezá Gratis<span className="sr-only"> (abre en otra pestaña)</span></a>
  </footer>
}

function BookingIdentity({name,path}:{name:string;path:string|null}) {
  const url=logoUrl(path)
  return <div className="flex min-w-0 items-center gap-4">{url&&<img key={url} src={url} alt={`Logo de ${name}`} className="size-16 shrink-0 rounded-xl bg-white object-contain p-1" onError={event=>{event.currentTarget.hidden=true}}/>}<div className="flex min-w-0 flex-col gap-1"><span className="break-words font-head text-xl font-extrabold">{name}</span><span className="flex flex-wrap items-center gap-1 text-sm text-muted">Reservas con <a href="https://cale.com.ar" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-6 items-center gap-1.5 rounded font-semibold text-fg underline-offset-4 hover:underline"><img src="/favicon.svg" alt="" className="size-4 shrink-0" />Cale<span className="sr-only"> (abre en otra pestaña)</span></a></span></div></div>
}
