import { ArrowLeft, CaretLeft, CaretRight, Plus, ProhibitInset } from '@phosphor-icons/react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { AppointmentForm } from '../components/agenda/AppointmentForm.tsx'
import { BlockForm } from '../components/agenda/BlockForm.tsx'
import { DayGrid } from '../components/agenda/DayGrid.tsx'
import { ItemDetail } from '../components/agenda/ItemDetail.tsx'
import { Modal } from '../components/Modal.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'
import { AgendaLoadError, fetchAgenda, fetchDayCounts, type AgendaData } from '../lib/agenda-api.ts'
import { dayItems, minutesToTime, visibleRange, weekDates, type AgendaItem } from '../lib/agenda.ts'
import { addDays, dayOfMonth, formatLongDate, monthName, todayInArgentina } from '../lib/dates.ts'
import { emptyWeek, hasAnyHours, type WeekHours } from '../lib/hours.ts'
import { fetchHours, HoursLoadError } from '../lib/hours-api.ts'
import { fetchServices, ServiceLoadError, type Service } from '../lib/services.ts'
import { fetchTeam, TeamLoadError, type Business, type TeamMember } from '../lib/business.ts'
import { DEFAULT_BRANDING, type Branding } from '../lib/branding.ts'
import { fetchBranding } from '../lib/branding-api.ts'
import { calendarColorForProfessional } from '../lib/agenda-colors.ts'

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
  onBack?: () => void
  aside?: ReactNode
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function AgendaScreen({ business, onBack, aside }: AgendaScreenProps) {
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
  const [counts, setCounts] = useState<{ today: number; tomorrow: number } | null>(null)
  const [countsError, setCountsError] = useState(false)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING)
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('all')
  const canManageTeam = business.role === 'owner' || business.role === 'admin'
  const isProfessional = business.role === 'professional'
  useEffect(() => {
    let active = true
    setCountsError(false)
    fetchDayCounts(business.id, today, selectedProfessionalId === 'all' ? undefined : selectedProfessionalId).then(value => { if (active) setCounts(value) }).catch((error: unknown) => {
      if (!(error instanceof AgendaLoadError)) throw error
      if (active) setCountsError(true)
    })
    return () => { active = false }
  }, [business.id, today, reloadCount, selectedProfessionalId])

  useEffect(() => {
    let cancelled = false
    fetchTeam(business.id).then(value => {
      if (!cancelled) setTeam(value.members)
    }).catch((error: unknown) => {
      if (!(error instanceof TeamLoadError)) throw error
      if (!cancelled) setTeam([])
    })
    return () => { cancelled = true }
  }, [business.id, canManageTeam])

  useEffect(() => {
    let cancelled = false
    fetchBranding(business.id).then(value => {
      if (!cancelled) setBranding(value)
    }).catch(() => {
      if (!cancelled) setBranding(DEFAULT_BRANDING)
    })
    return () => { cancelled = true }
  }, [business.id])

  const dates = view === 'day' ? [date] : weekDates(date)
  const firstDate = dates[0] ?? date
  const lastDate = dates.at(-1) ?? date

  // El horario y los servicios se leen una vez: sirven para dibujar la grilla y para los formularios
  useEffect(() => {
    let cancelled = false
    Promise.all([fetchHours(business.id, selectedProfessionalId === 'all' ? undefined : selectedProfessionalId), fetchServices(business.id)])
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
  }, [business.id, selectedProfessionalId])

  useEffect(() => {
    let cancelled = false
    fetchAgenda(business.id, firstDate, lastDate)
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
  }, [firstDate, lastDate, reloadCount, business.id])

  useEffect(() => {
    const timer = window.setInterval(() => setReloadCount(count => count + 1), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const appointments = load.status === 'ready'
    ? load.appointments.filter(item => selectedProfessionalId === 'all' || item.professional_id === selectedProfessionalId)
    : []
  const blocks = load.status === 'ready'
    ? load.blocks.filter(item => selectedProfessionalId === 'all' || item.professional_id === null || item.professional_id === selectedProfessionalId)
    : []
  const appointmentsWithPresentation = appointments.map(appointment => {
    const member = team.find(candidate => candidate.user_id === appointment.professional_id)
    return {
      ...appointment,
      professional_name: member?.display_name || member?.email || 'Profesional',
      professional_color: calendarColorForProfessional(appointment.professional_id, team, branding),
    }
  })
  const itemsByDate = Object.fromEntries(dates.map(day => [day, dayItems(day, appointmentsWithPresentation, blocks)]))
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
    <div className="agenda-workspace">
      <div className="natural-agenda-heading rise-in flex flex-wrap items-center justify-between gap-4" style={{ '--i': 0 } as CSSProperties}>
        <div className="agenda-heading-copy"><h1 className="screen-title">Tu agenda</h1><p className="agenda-today">{capitalize(formatLongDate(today))}</p></div>
      <div className="natural-agenda-actions flex flex-wrap items-center gap-3" style={{ '--i': 1 } as CSSProperties}>
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
        {onBack && <button type="button" className={SECONDARY_BUTTON} onClick={onBack}>
          <ArrowLeft weight="bold" className="size-5" aria-hidden="true" />
          Volver al panel
        </button>}
      </div>

      <div className="agenda-overview">
      <div className="natural-agenda-counts flex flex-wrap gap-6 text-base" aria-live="polite">
        {countsError ? <p className="text-muted">No pudimos cargar los contadores.</p> : counts ? <><p>Hoy <strong className="ml-2">{counts.today} {counts.today === 1 ? 'turno' : 'turnos'}</strong></p><p>Mañana <strong className="ml-2">{counts.tomorrow} {counts.tomorrow === 1 ? 'turno' : 'turnos'}</strong></p></> : <p role="status" className="text-muted">Cargando los turnos de hoy y mañana…</p>}
      </div>

      {canManageTeam && team.length > 0 ? (
        <label className="agenda-team-filter">
          Agenda de
          <select className="field" value={selectedProfessionalId} onChange={event => setSelectedProfessionalId(event.target.value)}>
            <option value="all">Todo el equipo</option>
            {team.map(member => <option key={member.user_id} value={member.user_id}>{member.display_name || member.email || 'Profesional'}</option>)}
          </select>
        </label>
      ) : null}
      </div>

      {!setupFailed && isProfessional && (services.length === 0 || !hasAnyHours(hours)) ? (
        <div className="flex flex-col gap-1 rounded-[12px] bg-tint p-3 text-base" role="status">
          {services.length === 0 ? <p>Contactá al administrador del negocio para agregar servicios a tu agenda.</p> : null}
          {!hasAnyHours(hours) ? <p>Contactá al administrador del negocio para agregar tus horarios de atención.</p> : null}
        </div>
      ) : null}
      {!setupFailed && !isProfessional && services.length === 0 ? (
        <p className="rounded-[12px] bg-tint p-3 text-base">Para cargar turnos a mano, primero cargá un servicio.</p>
      ) : null}

      <div className={aside ? "natural-agenda-layout" : ""}><div className="natural-agenda-sheet">
      <div className="natural-agenda-toolbar rise-in flex flex-wrap items-center justify-between gap-3" style={{ '--i': 2 } as CSSProperties}>
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

      </div>{aside && <aside className="natural-agenda-aside">{aside}</aside>}</div>

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
            team={team}
            canManageTeam={canManageTeam}
            initialProfessionalId={selectedProfessionalId === 'all' ? undefined : selectedProfessionalId}
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
