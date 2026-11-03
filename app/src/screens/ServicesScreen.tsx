import { ArrowLeft, Check, PencilSimple, Plus, Scissors, Trash } from '@phosphor-icons/react'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { SelectField } from '../components/SelectField.tsx'
import { TextField } from '../components/TextField.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'
import type { Business } from '../lib/business.ts'
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
}

export function ServicesScreen({ business, onBack }: ServicesScreenProps) {
  const [list, setList] = useState<ListState>({ status: 'loading' })
  const [reloadCount, setReloadCount] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(DEFAULT_DURATION_MINUTES)
  const [errors, setErrors] = useState<ServiceFormErrors>({})
  const [busy, setBusy] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchServices()
      .then(services => {
        if (!cancelled) setList({ status: 'ready', services })
      })
      .catch((error: unknown) => {
        if (!(error instanceof ServiceLoadError)) throw error
        if (!cancelled) setList({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [reloadCount])

  const reload = () => setReloadCount(count => count + 1)

  function resetForm() {
    setEditingId(null)
    setName('')
    setDuration(DEFAULT_DURATION_MINUTES)
    setErrors({})
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    const input = { name: name.trim(), duration_minutes: duration }
    const result = editingId ? await updateService(editingId, input) : await createService(business.id, input)
    setBusy(false)
    if (result.ok) {
      resetForm()
      reload()
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
    setErrors({})
  }

  const durationOptions = [...new Set([...DURATION_OPTIONS_MINUTES, duration])]
    .sort((a, b) => a - b)
    .map(minutes => ({ value: minutes, label: formatDuration(minutes) }))

  return (
    <div className="flex flex-col gap-8 pt-2 md:pt-6">
      <div className="rise-in flex flex-wrap items-center justify-between gap-4" style={{ '--i': 0 } as CSSProperties}>
        <h1 className="text-[1.875rem] md:text-[2.5rem]">Tus servicios</h1>
        <button type="button" className={SECONDARY_BUTTON} onClick={onBack}>
          <ArrowLeft weight="bold" className="size-5" aria-hidden="true" />
          Volver al panel
        </button>
      </div>

      <div className="grid items-start gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-14">
        <form
          onSubmit={submit}
          noValidate
          className="rise-in flex flex-col gap-5 rounded-[2rem] bg-surface p-6 shadow-soft md:p-8"
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
          {errors.general ? (
            <p role="alert" className="rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
              {errors.general}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={`${PRIMARY_BUTTON} sm:w-auto sm:flex-1`} disabled={busy}>
              {editingId ? <Check weight="bold" className="size-5" aria-hidden="true" /> : <Plus weight="bold" className="size-5" aria-hidden="true" />}
              {editingId ? 'Guardar cambios' : 'Agregar servicio'}
            </button>
            {editingId ? (
              <button type="button" className={SECONDARY_BUTTON} onClick={resetForm} disabled={busy}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

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
                      <p className="text-base text-muted">{formatDuration(service.duration_minutes)}</p>
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
