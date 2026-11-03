import { ArrowLeft, CaretLeft, CaretRight, Plus, ProhibitInset } from '@phosphor-icons/react'
import { useEffect, useState, type CSSProperties } from 'react'
import { AppointmentForm } from '../components/agenda/AppointmentForm.tsx'
import { BlockForm } from '../components/agenda/BlockForm.tsx'
import { DayGrid } from '../components/agenda/DayGrid.tsx'
import { ItemDetail } from '../components/agenda/ItemDetail.tsx'
import { Modal } from '../components/Modal.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'
import { AgendaLoadError, fetchAgenda, type AgendaData } from '../lib/agenda-api.ts'
import { dayItems, minutesToTime, visibleRange, weekDates, type AgendaItem } from '../lib/agenda.ts'
import { addDays, dayOfMonth, formatLongDate, monthName, todayInArgentina } from '../lib/dates.ts'
import { emptyWeek, type WeekHours } from '../lib/hours.ts'
import { fetchHours, HoursLoadError } from '../lib/hours-api.ts'
import { fetchServices, ServiceLoadError, type Service } from '../lib/services.ts'
import type { Business } from '../lib/business.ts'

type View = 'day' | 'week'

type DialogState =
  | { kind: 'appointment-form'; date: string; time: string }
  | { kind: 'block-form'; date: string; time: string }
  | { kind: 'detail'; item: AgendaItem; date: string }
  | null

type LoadState = { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & AgendaData)

// La agenda se vuelve a leer sola cada minuto, por si entró una reserva nueva
const REFRESH_INTERVAL_MS = 60_000
const NOTICE_MS = 3000
const DAYS_PER_WEEK = 7
const MINUTES_PER_HOUR = 60
// Último horario de inicio que ofrece la lista de horas
const LAST_START_MINUTES = 23 * MINUTES_PER_HOUR + 45

interface AgendaScreenProps {
  business: Business
  onBack: () => void
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function AgendaScreen({ business, onBack }: AgendaScreenProps) {
  const today = todayInArgentina()
  const [view, setView] = useState<View>('day')
  const [date, setDate] = useState(today)
  const [hours, setHours] = useState<WeekHours>(emptyWeek())
  const [services, setServices] = useState<Service[]>([])
  const [setupFailed, setSetupFailed] = useState(false)
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [reloadCount, setReloadCount] = useState(0)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const dates = view === 'day' ? [date] : weekDates(date)
  const firstDate = dates[0] ?? date
  const lastDate = dates.at(-1) ?? date

  // El horario y los servicios se leen una vez: sirven para dibujar la grilla y para los formularios
  useEffect(() => {
    let cancelled = false
    Promise.all([fetchHours(), fetchServices()])
      .then(([loadedHours, loadedServices]) => {
        if (cancelled) return
        setHours(loadedHours)
        setServices(loadedServices)
      })
      .catch((error: unknown) => {
        if (!(error instanceof HoursLoadError || error instanceof ServiceLoadError)) throw error
        if (!cancelled) setSetupFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAgenda(firstDate, lastDate)
      .then(data => {
        if (!cancelled) setLoad({ status: 'ready', ...data })
      })
      .catch((error: unknown) => {
        if (!(error instanceof AgendaLoadError)) throw error
        if (!cancelled) setLoad({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [firstDate, lastDate, reloadCount])

  useEffect(() => {
    const timer = window.setInterval(() => setReloadCount(count => count + 1), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const appointments = load.status === 'ready' ? load.appointments : []
  const blocks = load.status === 'ready' ? load.blocks : []
  const itemsByDate = Object.fromEntries(dates.map(day => [day, dayItems(day, appointments, blocks)]))
  const range = visibleRange(dates, hours, Object.values(itemsByDate).flat())
  const reload = () => setReloadCount(count => count + 1)

  // Fecha y hora con que se abre un formulario desde los botones: hoy si se está mirando el pasado, y la hora en que abre la grilla
  const defaultDate = date < today ? today : date
  const defaultTime = minutesToTime(Math.min(range.start, LAST_START_MINUTES))

  function done(message: string) {
    setDialog(null)
    setNotice(message)
    reload()
  }

  function openFromGrid(day: string, minutes: number) {
    if (day < today || services.length === 0) return
    setDialog({ kind: 'appointment-form', date: day, time: minutesToTime(Math.min(minutes, LAST_START_MINUTES)) })
  }

  const step = view === 'day' ? 1 : DAYS_PER_WEEK
  const title =
    view === 'day'
      ? capitalize(formatLongDate(date))
      : `${dayOfMonth(firstDate)} al ${dayOfMonth(lastDate)} de ${monthName(lastDate)}`

  return (
    <div className="flex flex-col gap-6 pt-2 md:pt-6">
      <div className="rise-in flex flex-wrap items-center justify-between gap-4" style={{ '--i': 0 } as CSSProperties}>
        <h1 className="text-[1.875rem] md:text-[2.5rem]">Tu agenda</h1>
        <button type="button" className={SECONDARY_BUTTON} onClick={onBack}>
          <ArrowLeft weight="bold" className="size-5" aria-hidden="true" />
          Volver al panel
        </button>
      </div>

      <div className="rise-in flex flex-wrap items-center gap-3" style={{ '--i': 1 } as CSSProperties}>
        <button
          type="button"
          className={`${PRIMARY_BUTTON} sm:w-auto`}
          onClick={() => setDialog({ kind: 'appointment-form', date: defaultDate, time: defaultTime })}
          disabled={services.length === 0}
        >
          <Plus weight="bold" className="size-5" aria-hidden="true" />
          Nuevo turno
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
          onClick={() => setDialog({ kind: 'block-form', date: defaultDate, time: defaultTime })}
        >
          <ProhibitInset weight="bold" className="size-5" aria-hidden="true" />
          Bloquear horario
        </button>
        {notice ? (
          <span role="status" className="text-base font-medium text-ok">
            {notice}
          </span>
        ) : null}
      </div>

      {services.length === 0 && !setupFailed ? (
        <p className="rounded-[12px] bg-tint p-3 text-base">Para cargar turnos a mano, primero cargá un servicio.</p>
      ) : null}

      <div className="rise-in flex flex-wrap items-center justify-between gap-3" style={{ '--i': 2 } as CSSProperties}>
        <div className="flex items-center gap-2">
          <button type="button" aria-label={view === 'day' ? 'Día anterior' : 'Semana anterior'} className={`${SECONDARY_BUTTON} px-3`} onClick={() => setDate(addDays(date, -step))}>
            <CaretLeft weight="bold" className="size-5" aria-hidden="true" />
          </button>
          <button type="button" aria-label={view === 'day' ? 'Día siguiente' : 'Semana siguiente'} className={`${SECONDARY_BUTTON} px-3`} onClick={() => setDate(addDays(date, step))}>
            <CaretRight weight="bold" className="size-5" aria-hidden="true" />
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setDate(today)}>
            Hoy
          </button>
          <p className="ml-2 font-head text-lg font-extrabold tracking-tight" aria-live="polite">
            {title}
          </p>
        </div>
        <div className="flex gap-1 rounded-[14px] bg-line p-1" role="group" aria-label="Vista de la agenda">
          {(['day', 'week'] as const).map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={`h-10 rounded-[11px] px-4 font-head text-base font-extrabold tracking-tight transition duration-200 ${
                view === option ? 'bg-ink text-on-ink' : 'text-muted hover:text-fg'
              }`}
            >
              {option === 'day' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>
      </div>

      {load.status === 'loading' ? <div className="skeleton h-96 w-full rounded-[1.5rem]" role="status" aria-label="Cargando la agenda" /> : null}

      {load.status === 'error' ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted">No pudimos cargar tu agenda.</p>
          <button type="button" className={SECONDARY_BUTTON} onClick={reload}>
            Reintentar
          </button>
        </div>
      ) : null}

      {load.status === 'ready' ? (
        <div className="rise-in" style={{ '--i': 3 } as CSSProperties}>
          <DayGrid
            dates={dates}
            today={today}
            itemsByDate={itemsByDate}
            hours={hours}
            range={range}
            onEmptyClick={openFromGrid}
            onItemClick={item => {
              const day = dates.find(candidate => (itemsByDate[candidate] ?? []).includes(item)) ?? date
              setDialog({ kind: 'detail', item, date: day })
            }}
          />
          <p className="mt-3 text-[0.9375rem] text-muted">
            Tocá un horario libre para cargar un turno. Las franjas claras son tu horario de atención.
          </p>
        </div>
      ) : null}

      {dialog?.kind === 'appointment-form' ? (
        <Modal title="Nuevo turno" onClose={() => setDialog(null)}>
          <AppointmentForm
            businessId={business.id}
            services={services}
            initialDate={dialog.date}
            initialTime={dialog.time}
            onSaved={() => done('Turno cargado.')}
            onCancel={() => setDialog(null)}
          />
        </Modal>
      ) : null}

      {dialog?.kind === 'block-form' ? (
        <Modal title="Bloquear horario" onClose={() => setDialog(null)}>
          <BlockForm
            businessId={business.id}
            initialDate={dialog.date}
            initialTime={dialog.time}
            onSaved={() => done('Horario bloqueado.')}
            onCancel={() => setDialog(null)}
          />
        </Modal>
      ) : null}

      {dialog?.kind === 'detail' ? (
        <Modal title={dialog.item.kind === 'block' ? 'Bloqueo' : 'Turno'} onClose={() => setDialog(null)}>
          <ItemDetail
            item={dialog.item}
            date={dialog.date}
            onChanged={() => done(dialog.item.kind === 'block' ? 'Bloqueo quitado.' : 'Turno cancelado.')}
            onClose={() => setDialog(null)}
          />
        </Modal>
      ) : null}
    </div>
  )
}
