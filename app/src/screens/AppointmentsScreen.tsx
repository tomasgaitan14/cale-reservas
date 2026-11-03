import { ArrowLeft, CalendarBlank, Trash } from '@phosphor-icons/react'
import { useEffect, useState, type CSSProperties } from 'react'
import { SECONDARY_BUTTON } from '../components/ui.ts'
import { AppointmentLoadError, cancelAppointment, fetchUpcomingAppointments, type Appointment } from '../lib/appointments.ts'
import { formatLongDate, localParts } from '../lib/dates.ts'

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; appointments: Appointment[] }

interface AppointmentsScreenProps {
  onBack: () => void
}

// Turnos próximos agrupados por día, con la hora en Argentina
function groupByDay(appointments: Appointment[]): { date: string; items: Appointment[] }[] {
  const groups = new Map<string, Appointment[]>()
  for (const appointment of appointments) {
    const { date } = localParts(appointment.starts_at)
    groups.set(date, [...(groups.get(date) ?? []), appointment])
  }
  return [...groups].map(([date, items]) => ({ date, items }))
}

export function AppointmentsScreen({ onBack }: AppointmentsScreenProps) {
  const [list, setList] = useState<ListState>({ status: 'loading' })
  const [reloadCount, setReloadCount] = useState(0)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchUpcomingAppointments()
      .then(appointments => {
        if (!cancelled) setList({ status: 'ready', appointments })
      })
      .catch((error: unknown) => {
        if (!(error instanceof AppointmentLoadError)) throw error
        if (!cancelled) setList({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [reloadCount])

  const reload = () => setReloadCount(count => count + 1)

  async function cancel(id: string) {
    setConfirmingId(null)
    setActionError(null)
    const result = await cancelAppointment(id)
    if (result.ok) reload()
    else setActionError(result.message)
  }

  return (
    <div className="flex flex-col gap-8 pt-2 md:pt-6">
      <div className="rise-in flex flex-wrap items-center justify-between gap-4" style={{ '--i': 0 } as CSSProperties}>
        <h1 className="text-[1.875rem] md:text-[2.5rem]">Tus turnos</h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SECONDARY_BUTTON} onClick={reload}>
            Actualizar
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={onBack}>
            <ArrowLeft weight="bold" className="size-5" aria-hidden="true" />
            Volver al panel
          </button>
        </div>
      </div>

      <section className="rise-in flex max-w-3xl flex-col gap-6" style={{ '--i': 1 } as CSSProperties} aria-label="Turnos próximos">
        {actionError ? (
          <p role="alert" className="rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
            {actionError}
          </p>
        ) : null}

        {list.status === 'loading' ? (
          <div className="flex flex-col gap-4" role="status" aria-label="Cargando tus turnos">
            <div className="skeleton h-20 w-full rounded-xl" />
            <div className="skeleton h-20 w-full rounded-xl" />
          </div>
        ) : null}

        {list.status === 'error' ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted">No pudimos cargar tus turnos.</p>
            <button type="button" className={SECONDARY_BUTTON} onClick={reload}>
              Reintentar
            </button>
          </div>
        ) : null}

        {list.status === 'ready' && list.appointments.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-[1.25rem] bg-tint p-6">
            <span className="grid size-11 place-items-center rounded-[12px] bg-surface">
              <CalendarBlank weight="bold" className="size-6" aria-hidden="true" />
            </span>
            <p className="font-head text-lg font-extrabold tracking-tight">Todavía no tenés turnos reservados</p>
            <p className="text-muted">Cuando alguien reserve desde tu página, el turno aparece acá.</p>
          </div>
        ) : null}

        {list.status === 'ready'
          ? groupByDay(list.appointments).map(({ date, items }) => (
              <div key={date} className="flex flex-col">
                <h2 className="mb-1 text-[1.3125rem] first-letter:uppercase">{formatLongDate(date)}</h2>
                <ul className="divide-y-2 divide-line">
                  {items.map(appointment => (
                    <li key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div className="flex min-w-0 flex-col">
                        <p className="font-head text-lg font-extrabold tracking-tight">
                          {localParts(appointment.starts_at).time} a {localParts(appointment.ends_at).time}
                          <span className="ml-2 text-base font-medium text-muted">{appointment.service_name}</span>
                        </p>
                        <p className="break-words text-base">
                          {appointment.client_name} <span className="text-muted">· +{appointment.client_phone}</span>
                        </p>
                      </div>
                      {confirmingId === appointment.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-medium">¿Cancelar este turno?</span>
                          <button type="button" className={SECONDARY_BUTTON} onClick={() => void cancel(appointment.id)}>
                            Sí, cancelar
                          </button>
                          <button type="button" className={SECONDARY_BUTTON} onClick={() => setConfirmingId(null)}>
                            No
                          </button>
                        </div>
                      ) : (
                        <button type="button" className={SECONDARY_BUTTON} onClick={() => setConfirmingId(appointment.id)}>
                          <Trash weight="bold" className="size-5" aria-hidden="true" />
                          Cancelar turno
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          : null}
      </section>
    </div>
  )
}
