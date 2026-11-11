import { ArrowLeft, CheckCircle, Plus, WarningCircle, X } from '@phosphor-icons/react'
import { useEffect, useState, type CSSProperties } from 'react'
import { TimeSelect } from '../components/TimeSelect.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'
import type { Business } from '../lib/business.ts'
import {
  DAYS,
  DEFAULT_RANGE,
  defaultWeek,
  emptyWeek,
  findDayProblems,
  hasAnyHours,
  nextRange,
  type TimeRange,
  type WeekHours,
} from '../lib/hours.ts'
import { fetchHours, HoursLoadError, saveHours } from '../lib/hours-api.ts'
import { fetchTeam, TeamLoadError, type TeamMember } from '../lib/business.ts'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready' }
type SaveMessage = { kind: 'ok' | 'error'; text: string }

interface HoursScreenProps {
  business: Business
  onBack: () => void
  onContinue?: () => void
}

export function HoursScreen({ business, onBack, onContinue }: HoursScreenProps) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [team, setTeam] = useState<TeamMember[]>([])
  const [professionalId, setProfessionalId] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [week, setWeek] = useState<WeekHours>(emptyWeek())
  const [problems, setProblems] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<SaveMessage | null>(null)
  const canManage = !business.role || business.role === 'owner' || business.role === 'admin'

  useEffect(() => {
    let cancelled = false
    fetchTeam(business.id)
      .then(({ members }) => {
        if (cancelled) return
        setTeam(members)
        const preferred = members.find(member => member.role === 'owner') ?? members[0]
        setProfessionalId(current => current && members.some(member => member.user_id === current) ? current : preferred?.user_id ?? '')
      })
      .catch((error: unknown) => {
        if (!(error instanceof TeamLoadError)) throw error
        if (!cancelled) setLoad({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [business.id])

  useEffect(() => {
    if (!professionalId) return
    let cancelled = false
    setLoad({ status: 'loading' })
    fetchHours(business.id, professionalId)
      .then(loaded => {
        if (cancelled) return
        setWeek(onContinue && !hasAnyHours(loaded) ? defaultWeek() : loaded)
        setLoad({ status: 'ready' })
      })
      .catch((error: unknown) => {
        if (!(error instanceof HoursLoadError)) throw error
        if (!cancelled) setLoad({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [reloadCount, onContinue, business.id, professionalId])

  function changeDay(day: number, ranges: TimeRange[]) {
    setWeek(current => ({ ...current, [day]: ranges }))
    setProblems(current => Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== day)))
    setMessage(null)
  }

  function changeRange(day: number, index: number, field: keyof TimeRange, value: string) {
    changeDay(day, (week[day] ?? []).map((range, position) => (position === index ? { ...range, [field]: value } : range)))
  }

  async function save() {
    const found = findDayProblems(week)
    setProblems(found)
    if (Object.keys(found).length > 0) {
      setMessage({ kind: 'error', text: 'Revisá los días marcados antes de guardar.' })
      return
    }
    if (onContinue && !hasAnyHours(week)) {
      setMessage({ kind: 'error', text: 'Elegí al menos un horario para continuar.' }); return
    }
    setSaving(true)
    setMessage(null)
    const result = await saveHours(business.id, professionalId, week)
    setSaving(false)
    setMessage(result.ok ? { kind: 'ok', text: 'Horarios guardados.' } : { kind: 'error', text: result.message })
    if (result.ok) onContinue?.()
  }

  return (
    <div className="panel-editor hours-editor">
      <div className="panel-page-header rise-in flex flex-wrap items-center justify-between gap-4" style={{ '--i': 0 } as CSSProperties}>
        <h1 className="text-[1.875rem] md:text-[2.5rem]">Tus horarios</h1>
        <button type="button" className={SECONDARY_BUTTON} onClick={onBack}>
          <ArrowLeft weight="bold" className="size-5" aria-hidden="true" />
          {onContinue ? 'Seguir después' : 'Volver al negocio'}
        </button>
      </div>

      <div className="hours-layout">
        <p className="editor-description rise-in text-muted" style={{ '--i': 1 } as CSSProperties}>
          Marcá los días que atendés y a qué hora. Si cortás al mediodía, agregá otro horario para ese día.
        </p>

        <section className="rise-in flex flex-col gap-5" style={{ '--i': 2 } as CSSProperties} aria-label="Horarios de la semana">
          {canManage && team.length > 0 ? (
            <label className="hours-professional-filter flex flex-col gap-2 text-sm font-semibold text-muted">
              Horarios de
              <select className="field" value={professionalId} onChange={event => { setProfessionalId(event.target.value); setMessage(null) }}>
                {team.map(member => <option key={member.user_id} value={member.user_id}>{member.display_name || member.email || 'Profesional'}</option>)}
              </select>
            </label>
          ) : null}
          {load.status === 'loading' ? (
            <div className="flex flex-col gap-3" role="status" aria-label="Cargando tus horarios">
              {DAYS.map(day => (
                <div key={day.value} className="skeleton h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : null}

          {load.status === 'error' ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted">No pudimos cargar tus horarios.</p>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setReloadCount(count => count + 1)}>
                Reintentar
              </button>
            </div>
          ) : null}

          {load.status === 'ready' ? (
            <>
              {!hasAnyHours(week) ? (
                <div className="flex flex-col items-start gap-3 rounded-[1.25rem] bg-tint p-5">
                  <p className="font-head text-lg font-extrabold tracking-tight">Todavía no cargaste horarios</p>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON}
                    onClick={() => {
                      setWeek(defaultWeek())
                      setMessage(null)
                    }}
                  >
                    Usar de lunes a viernes, de 9 a 18
                  </button>
                </div>
              ) : null}

              <ul className="hours-week">
                {DAYS.map(day => {
                  const ranges = week[day.value] ?? []
                  const open = ranges.length > 0
                  const addable = nextRange(ranges)
                  const problem = problems[day.value]
                  return (
                    <li key={day.value} className="hours-day">
                      <div className="hours-day-heading flex items-center justify-between gap-4">
                        <p className="font-head text-lg font-extrabold tracking-tight">{day.label}</p>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={open}
                          aria-label={`Atiendo el ${day.label.toLowerCase()}`}
                          onClick={() => changeDay(day.value, open ? [] : [{ ...DEFAULT_RANGE }])}
                          className={`flex h-9 flex-none items-center rounded-full px-3 text-[0.9375rem] font-bold transition-colors duration-200 ${
                            open ? 'bg-ok-bg text-ok' : 'bg-line text-muted'
                          }`}
                        >
                          {open ? 'Atiendo' : 'No atiendo'}
                        </button>
                      </div>

                      <div className="hours-day-ranges">
                      {!open && <p className="hours-day-closed">Sin atención este día</p>}
                      {ranges.map((range, index) => (
                        <div key={index} className="hours-range flex flex-wrap items-end gap-3">
                          <TimeSelect
                            id={`${day.value}-${index}-start`}
                            label="Desde"
                            role="start"
                            value={range.start}
                            invalid={Boolean(problem)}
                            onChange={value => changeRange(day.value, index, 'start', value)}
                          />
                          <TimeSelect
                            id={`${day.value}-${index}-end`}
                            label="Hasta"
                            role="end"
                            value={range.end}
                            invalid={Boolean(problem)}
                            onChange={value => changeRange(day.value, index, 'end', value)}
                          />
                          {ranges.length > 1 ? (
                            <button
                              type="button"
                              className={SECONDARY_BUTTON}
                              aria-label={`Quitar el horario de ${range.start} a ${range.end} del ${day.label.toLowerCase()}`}
                              onClick={() => changeDay(day.value, ranges.filter((_, position) => position !== index))}
                            >
                              <X weight="bold" className="size-5" aria-hidden="true" />
                              Quitar
                            </button>
                          ) : null}
                        </div>
                      ))}

                      {open && addable ? (
                        <div>
                          <button type="button" className={SECONDARY_BUTTON} onClick={() => changeDay(day.value, [...ranges, addable])}>
                            <Plus weight="bold" className="size-5" aria-hidden="true" />
                            Agregar otro horario
                          </button>
                        </div>
                      ) : null}

                      {problem ? (
                        <p role="alert" className="flex items-start gap-1.5 text-[0.9375rem] font-medium text-warn">
                          <WarningCircle weight="bold" className="mt-0.5 size-4 flex-none" aria-hidden="true" />
                          {problem}
                        </p>
                      ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="flex flex-col gap-3">
                <button type="button" className={PRIMARY_BUTTON} onClick={() => void save()} disabled={saving}>
                  {saving ? 'Guardando…' : onContinue ? 'Guardar y continuar' : 'Guardar horarios'}
                </button>
                {message ? (
                  <p
                    role={message.kind === 'error' ? 'alert' : 'status'}
                    className={`flex items-start gap-1.5 text-base font-medium ${message.kind === 'ok' ? 'text-ok' : 'text-warn'}`}
                  >
                    {message.kind === 'ok' ? (
                      <CheckCircle weight="bold" className="mt-0.5 size-5 flex-none" aria-hidden="true" />
                    ) : (
                      <WarningCircle weight="bold" className="mt-0.5 size-5 flex-none" aria-hidden="true" />
                    )}
                    {message.text}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
