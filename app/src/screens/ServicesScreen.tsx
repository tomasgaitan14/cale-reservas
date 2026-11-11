import { ArrowLeft, Check, PencilSimple, Plus, Scissors, Trash } from '@phosphor-icons/react'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { SelectField } from '../components/SelectField.tsx'
import { TextField } from '../components/TextField.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'
import { fetchTeam, TeamLoadError, type Business, type TeamMember } from '../lib/business.ts'
import { DEFAULT_DURATION_MINUTES, DURATION_OPTIONS_MINUTES, formatDuration } from '../lib/duration.ts'
import type { ServiceFormErrors } from '../lib/service-errors.ts'
import {
  createService,
  deleteService,
  fetchServices,
  ServiceLoadError,
  updateService,
  type Service,
  type ServiceResult,
} from '../lib/services.ts'

const MAX_NAME_LENGTH = 80

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; services: Service[] }

interface ServicesScreenProps {
  business: Business
  onBack: () => void
  onContinue?: () => void
}

export function ServicesScreen({ business, onBack, onContinue }: ServicesScreenProps) {
  const [list, setList] = useState<ListState>({ status: 'loading' })
  const [reloadCount, setReloadCount] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(DEFAULT_DURATION_MINUTES)
  const [professionalId, setProfessionalId] = useState('')
  const [team, setTeam] = useState<TeamMember[]>([])
  const [teamError, setTeamError] = useState(false)
  const [errors, setErrors] = useState<ServiceFormErrors>({})
  const [busy, setBusy] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchServices(business.id), fetchTeam(business.id)])
      .then(([services, loadedTeam]) => {
        if (!cancelled) {
          setList({ status: 'ready', services })
          setTeam(loadedTeam.members)
          setProfessionalId(current => current || loadedTeam.members[0]?.user_id || '')
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof ServiceLoadError || error instanceof TeamLoadError)) throw error
        if (!cancelled) {
          setList({ status: 'error' })
          setTeamError(error instanceof TeamLoadError)
        }
      })
    return () => {
      cancelled = true
    }
  }, [reloadCount, business.id])

  const reload = () => setReloadCount(count => count + 1)

  function resetForm() {
    setEditingId(null)
    setName('')
    setDuration(DEFAULT_DURATION_MINUTES)
    setProfessionalId(team[0]?.user_id ?? '')
    setErrors({})
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    const input = { name: name.trim(), duration_minutes: duration, professional_id: professionalId }
    const result = editingId ? await updateService(editingId, input) : await createService(business.id, input)
    setBusy(false)
    if (result.ok) {
      resetForm()
      reload()
      onContinue?.()
    } else {
      setErrors(result.errors)
    }
  }

  async function runAction(action: Promise<ServiceResult>) {
    setActionError(null)
    const result = await action
    if (result.ok) reload()
    else setActionError(result.errors.general ?? 'No pudimos hacer el cambio. Probá de nuevo.')
  }

  function startEditing(service: Service) {
    setEditingId(service.id)
    setName(service.name)
    setDuration(service.duration_minutes)
    setProfessionalId(service.professional_id)
    setErrors({})
  }

  const durationOptions = [...new Set([...DURATION_OPTIONS_MINUTES, duration])]
    .sort((a, b) => a - b)
    .map(minutes => ({ value: minutes, label: formatDuration(minutes) }))

  const editorForm = (
        <form
          onSubmit={submit}
          noValidate
          className="rise-in flex flex-col gap-5 rounded-[1.25rem] border border-line bg-surface p-6 md:p-8"
          style={{ '--i': 1 } as CSSProperties}
        >
          <h2 className="text-[1.3125rem]">{editingId ? 'Editar servicio' : 'Nuevo servicio'}</h2>
          <TextField
            id="service-name"
            label="Nombre"
            placeholder="Corte de pelo"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={event => {
              setName(event.target.value)
              setErrors(current => ({ ...current, name: undefined }))
            }}
            error={errors.name}
            required
          />
          <SelectField
            id="service-duration"
            label="Cuánto dura"
            options={durationOptions}
            value={duration}
            onChange={event => {
              setDuration(Number(event.target.value))
              setErrors(current => ({ ...current, duration: undefined }))
            }}
            error={errors.duration}
          />
          <SelectField
            id="service-professional"
            label="Profesional responsable"
            options={team.map(member => ({
              value: member.user_id,
              label: `${member.display_name || member.email || 'Profesional'}${member.role === 'professional' ? '' : ` · ${member.role === 'owner' ? 'Dueño' : 'Administrador'}`}`,
            }))}
            value={professionalId}
            onChange={event => setProfessionalId(event.target.value)}
            error={teamError ? 'No pudimos cargar el equipo.' : undefined}
          />
          <p className="-mt-3 text-sm text-muted">Este profesional atenderá los turnos de este servicio.</p>
          {errors.general ? (
            <p role="alert" className="rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
              {errors.general}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={`${PRIMARY_BUTTON} sm:w-auto sm:flex-1`} disabled={busy || !professionalId}>
              {editingId ? <Check weight="bold" className="size-5" aria-hidden="true" /> : <Plus weight="bold" className="size-5" aria-hidden="true" />}
              {editingId ? 'Guardar cambios' : onContinue ? 'Guardar y continuar' : 'Agregar servicio'}
            </button>
            {editingId ? (
              <button type="button" className={SECONDARY_BUTTON} onClick={resetForm} disabled={busy}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
  )
  if (onContinue) return <section className="warm-split">
    <div className="flex flex-col gap-5">
      <h1 className="screen-title">Empecemos por un servicio.</h1>
      <p className="max-w-md text-lg text-muted">Contanos qué ofrecés y cuánto dura. Después podés sumar más.</p>
      <svg viewBox="0 0 240 200" className="mt-4 w-52 max-w-full text-link opacity-65" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <rect x="70" y="54" width="115" height="112" rx="14" /><path d="M70 83h115M96 43v24M158 43v24M51 156c-27-42-16-81 1-112M49 103c-25-3-31-18-28-33 20 3 31 12 28 33ZM50 81c21-1 30-15 29-28-17-1-26 10-29 28ZM156 181c16-19 34-23 55-17-11 13-27 16-44 12M175 161l28-33" />
        <g fill="currentColor" stroke="none" opacity=".25"><rect x="91" y="99" width="16" height="16" rx="3"/><rect x="122" y="99" width="16" height="16" rx="3"/><rect x="153" y="99" width="16" height="16" rx="3"/><rect x="91" y="128" width="16" height="16" rx="3"/><rect x="122" y="128" width="16" height="16" rx="3"/></g>
      </svg>
    </div>
    <div className="flex flex-col gap-4">{editorForm}<p className="text-sm text-muted">Podés cambiarlo cuando quieras.</p></div>
  </section>

  return (
    <div className="panel-editor services-editor">
      <div className="panel-page-header rise-in flex flex-wrap items-center justify-between gap-4" style={{ '--i': 0 } as CSSProperties}>
        <h1 className="text-[1.875rem] md:text-[2.5rem]">{onContinue ? 'Empecemos por un servicio.' : 'Tus servicios'}</h1>
        <button type="button" className={SECONDARY_BUTTON} onClick={onBack}>
          <ArrowLeft weight="bold" className="size-5" aria-hidden="true" />
          {onContinue ? 'Seguir después' : 'Volver al negocio'}
        </button>
      </div>

      <div className="services-layout">
        {editorForm}

        <section className="rise-in flex flex-col" style={{ '--i': 2 } as CSSProperties} aria-labelledby="services-title">
          <h2 id="services-title" className="mb-2 text-[1.3125rem]">
            Lo que ofrecés
          </h2>
          {actionError ? (
            <p role="alert" className="mb-2 rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
              {actionError}
            </p>
          ) : null}
          {list.status === 'loading' ? <ServicesSkeleton /> : null}
          {list.status === 'error' ? (
            <div className="flex flex-col items-start gap-3 py-4">
              <p className="text-muted">No pudimos cargar tus servicios.</p>
              <button type="button" className={SECONDARY_BUTTON} onClick={reload}>
                Reintentar
              </button>
            </div>
          ) : null}
          {list.status === 'ready' && list.services.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-[1.25rem] bg-tint p-6">
              <span className="grid size-11 place-items-center rounded-[12px] bg-surface text-fg">
                <Scissors weight="bold" className="size-6" aria-hidden="true" />
              </span>
              <p className="font-head text-lg font-extrabold tracking-tight">Todavía no cargaste ningún servicio</p>
              <p className="text-muted">Empezá por el que más hacés, por ejemplo un corte. Después sumás los demás.</p>
            </div>
          ) : null}
          {list.status === 'ready' && list.services.length > 0 ? (
            <ul className="divide-y-2 divide-line">
              {list.services.map(service => (
                <li key={service.id} className="flex flex-col gap-3 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col">
                      <p className="break-words font-head text-lg font-extrabold tracking-tight">{service.name}</p>
                      <p className="text-base text-muted">{formatDuration(service.duration_minutes)} · {team.find(member => member.user_id === service.professional_id)?.display_name || 'Profesional asignado'}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={service.active}
                      aria-label={`Se puede reservar ${service.name}`}
                      onClick={() => void runAction(updateService(service.id, { active: !service.active }))}
                      className={`flex h-9 flex-none items-center gap-2 rounded-full px-3 text-[0.9375rem] font-bold transition-colors duration-200 ${
                        service.active ? 'bg-ok-bg text-ok' : 'bg-line text-muted'
                      }`}
                    >
                      {service.active ? 'Se puede reservar' : 'Pausado'}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className={SECONDARY_BUTTON} onClick={() => startEditing(service)}>
                      <PencilSimple weight="bold" className="size-5" aria-hidden="true" />
                      Editar
                    </button>
                    {confirmingDeleteId === service.id ? (
                      <>
                        <span className="text-base font-medium">¿Eliminar este servicio?</span>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON}
                          onClick={() => {
                            setConfirmingDeleteId(null)
                            void runAction(deleteService(service.id))
                          }}
                        >
                          Sí, eliminar
                        </button>
                        <button type="button" className={SECONDARY_BUTTON} onClick={() => setConfirmingDeleteId(null)}>
                          No
                        </button>
                      </>
                    ) : (
                      <button type="button" className={SECONDARY_BUTTON} onClick={() => setConfirmingDeleteId(service.id)}>
                        <Trash weight="bold" className="size-5" aria-hidden="true" />
                        Eliminar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  )
}

function ServicesSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-2" role="status" aria-label="Cargando tus servicios">
      <div className="skeleton h-16 w-full rounded-xl" />
      <div className="skeleton h-16 w-full rounded-xl" />
    </div>
  )
}
