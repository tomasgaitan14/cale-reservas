import { CheckCircle } from '@phosphor-icons/react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { DatePicker } from '../components/booking/DatePicker.tsx'
import { DetailsForm, type BookingDetails } from '../components/booking/DetailsForm.tsx'
import { ServicePicker } from '../components/booking/ServicePicker.tsx'
import { TimePicker, type SlotsState } from '../components/booking/TimePicker.tsx'
import { Shell } from '../components/Shell.tsx'
import { SECONDARY_BUTTON } from '../components/ui.ts'
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
    <Shell>
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
      {state.status === 'ready' ? <BookingFlow slug={slug} info={state.info} /> : null}
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
}

function BookingFlow({ slug, info }: BookingFlowProps) {
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
    if (!serviceId || !date || !time) return
    setBusy(true)
    setErrors({})
    const result = await createBooking({ slug, serviceId, date, time, ...details })
    setBusy(false)
    if (result.ok) {
      setConfirmation(result.confirmation)
      return
    }
    setErrors(result.errors)
    // Si el horario se ocupó, se vuelve a buscar la lista para que no se ofrezca más
    if (result.errors.slot) {
      setTime(null)
      setSlotsAttempt(count => count + 1)
    }
  }

  if (confirmation) return <BookingDone confirmation={confirmation} businessName={info.name} />

  const bookable = info.services.length > 0 && info.open_days.length > 0

  return (
    <div className="grid items-start gap-10 pt-2 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:pt-8">
      <aside className="rise-in flex flex-col gap-6 md:sticky md:top-8" style={{ '--i': 0 } as CSSProperties}>
        <div className="flex flex-col gap-2">
          <p className="font-head text-base font-extrabold tracking-tight text-link">Reservá tu turno</p>
          <h1 className="break-words text-[1.875rem] md:text-[2.75rem] md:leading-[1.05]">{info.name}</h1>
        </div>
        {/* En el celular el resumen aparece recién cuando hay algo elegido, para que los servicios queden arriba */}
        <dl className={`flex-col gap-3 rounded-[1.25rem] bg-ink p-5 text-on-ink md:flex ${serviceId ? 'flex' : 'hidden'}`}>
          <SummaryRow label="Servicio" value={service ? `${service.name} · ${formatDuration(service.duration_minutes)}` : null} />
          <SummaryRow label="Día" value={date ? formatLongDate(date) : null} />
          <SummaryRow label="Hora" value={time} />
        </dl>
      </aside>

      <div className="flex min-w-0 flex-col gap-10">
        {!bookable ? (
          <p className="rise-in rounded-[1.25rem] bg-tint p-5 text-base" style={{ '--i': 1 } as CSSProperties}>
            Este negocio todavía no recibe reservas por acá. Volvé a probar más tarde.
          </p>
        ) : null}

        {bookable ? (
          <Step number={1} title="Elegí el servicio" index={1}>
            <ServicePicker
              services={info.services}
              selectedId={serviceId}
              onSelect={id => {
                setServiceId(id)
                setTime(null)
                setErrors({})
              }}
            />
          </Step>
        ) : null}

        {serviceId ? (
          <Step number={2} title="Elegí el día" index={2}>
            <DatePicker
              dates={dates}
              selected={date}
              onSelect={next => {
                setDate(next)
                setTime(null)
                setErrors({})
              }}
            />
          </Step>
        ) : null}

        {serviceId && date ? (
          <Step number={3} title="Elegí la hora" index={3}>
            <TimePicker
              slots={slots}
              selected={time}
              onSelect={next => {
                setTime(next)
                clearError('slot')
              }}
              onRetry={() => setSlotsAttempt(count => count + 1)}
            />
            {errors.slot ? (
              <p role="alert" className="mt-3 rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
                {errors.slot}
              </p>
            ) : null}
          </Step>
        ) : null}

        {serviceId && date && time ? (
          <Step number={4} title="Tus datos" index={4}>
            <DetailsForm errors={errors} busy={busy} onClearError={clearError} onSubmit={details => void submit(details)} />
          </Step>
        ) : null}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[0.9375rem] text-ink-muted">{label}</dt>
      <dd className={`font-head text-lg font-extrabold tracking-tight ${value ? '' : 'text-ink-muted'}`}>{value ?? 'Sin elegir'}</dd>
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

function BookingDone({ confirmation, businessName }: { confirmation: BookingConfirmation; businessName: string }) {
  return (
    <div className="rise-in flex max-w-xl flex-col items-start gap-6 pt-6 md:pt-14" role="status">
      <span className="grid size-14 place-items-center rounded-[1rem] bg-ok-bg text-ok">
        <CheckCircle weight="bold" className="size-8" aria-hidden="true" />
      </span>
      <h1 className="text-[1.875rem] md:text-[2.5rem]">Tu turno quedó reservado</h1>
      <div className="flex w-full flex-col gap-1 rounded-[1.25rem] bg-ink p-5 text-on-ink">
        <p className="font-head text-xl font-extrabold tracking-tight">{confirmation.service_name}</p>
        <p className="text-base">
          {formatLongDate(confirmation.date)} a las {confirmation.time}
        </p>
        <p className="text-[0.9375rem] text-ink-muted">{businessName}</p>
      </div>
      <p className="text-muted">
        Si el negocio tiene activados los recordatorios, te escribimos por WhatsApp antes del turno. Si no podés ir, avisale directamente al negocio.
      </p>
    </div>
  )
}
