import { ArrowSquareOut, CalendarBlank, CalendarCheck, CheckCircle, Clock, Copy, Scissors, Timer, WhatsappLogo } from '@phosphor-icons/react'
import { useEffect, useState, type CSSProperties } from 'react'
import { SECONDARY_BUTTON } from '../components/ui.ts'
import type { Business } from '../lib/business.ts'
import type { SetupProgress } from '../lib/setup.ts'
import { PAGE_ADDRESS_PREFIX } from '../lib/slug.ts'

export type PanelView = 'services' | 'hours' | 'agenda'

// Cuánto se muestra el aviso "Link copiado"
const COPIED_NOTICE_MS = 2000

type StepStatus = 'done' | 'todo' | 'soon' | 'loading'

interface Step {
  title: string
  detail: string
  status: StepStatus
  icon: typeof Clock
  action?: { label: string; view: PanelView }
}

function describeServices(count: number): string {
  if (count === 0) return 'Qué ofrecés y cuánto dura cada cosa.'
  return count === 1 ? 'Tenés 1 servicio cargado.' : `Tenés ${count} servicios cargados.`
}

function buildSteps(progress: SetupProgress | null): Step[] {
  const serviceStatus: StepStatus = !progress ? 'loading' : progress.serviceCount > 0 ? 'done' : 'todo'
  const hoursStatus: StepStatus = !progress ? 'loading' : progress.hasHours ? 'done' : 'todo'
  return [
    { title: 'Tu negocio', detail: 'Ya cargaste el nombre, la dirección de tu página y tu WhatsApp.', status: 'done', icon: CheckCircle },
    {
      title: 'Servicios',
      detail: describeServices(progress?.serviceCount ?? 0),
      status: serviceStatus,
      icon: Scissors,
      action: { label: serviceStatus === 'done' ? 'Editar servicios' : 'Cargar servicios', view: 'services' },
    },
    {
      title: 'Horarios',
      detail: hoursStatus === 'done' ? 'Ya cargaste los días y horas que atendés.' : 'Qué días y a qué hora atendés.',
      status: hoursStatus,
      icon: Timer,
      action: { label: hoursStatus === 'done' ? 'Editar horarios' : 'Cargar horarios', view: 'hours' },
    },
    { title: 'Google Calendar', detail: 'Cada turno nuevo aparece en tu calendario.', status: 'soon', icon: CalendarCheck },
    { title: 'WhatsApp', detail: 'Conectás tu número y elegís cuándo avisar a tus clientes.', status: 'soon', icon: WhatsappLogo },
  ]
}

const BADGE: Record<Exclude<StepStatus, 'loading'>, { label: string; className: string }> = {
  done: { label: 'Listo', className: 'bg-ok-bg text-ok' },
  todo: { label: 'Falta', className: 'bg-pend-bg text-pend' },
  soon: { label: 'Próximamente', className: 'bg-line text-muted' },
}

interface PanelHomeProps {
  business: Business
  progress: SetupProgress | null
  onOpen: (view: PanelView) => void
}

function describeUpcoming(count: number): string {
  if (count === 0) return 'Todavía no tenés turnos por delante.'
  return count === 1 ? 'Tenés 1 turno por delante.' : `Tenés ${count} turnos por delante.`
}

function AppointmentsCard({ progress, onOpen }: { progress: SetupProgress | null; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] bg-tint p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 flex-none place-items-center rounded-[12px] bg-surface">
          <CalendarBlank weight="bold" className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <p className="font-head text-lg font-extrabold tracking-tight">Tu agenda</p>
          {progress ? (
            <p className="text-base text-muted">{describeUpcoming(progress.upcomingCount)}</p>
          ) : (
            <span className="skeleton mt-1 h-5 w-40 rounded-md" role="status" aria-label="Cargando" />
          )}
        </div>
      </div>
      <button type="button" className={SECONDARY_BUTTON} onClick={onOpen}>
        Abrir agenda
      </button>
    </div>
  )
}

// Lo que ve el negocio sobre su página de reservas: si todavía no está lista, qué falta; si ya está, cómo abrirla y compartirla
function PageCard({ business, ready }: { business: Business; ready: boolean }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/${business.slug}`)
    setCopied(true)
  }

  return (
    <div className="flex flex-col gap-1 rounded-[1.25rem] bg-ink p-5 text-on-ink">
      <p className="text-[0.9375rem] text-ink-muted">Tu página de reservas</p>
      <p className="break-all font-head text-xl font-extrabold tracking-tight">
        {PAGE_ADDRESS_PREFIX}
        {business.slug}
      </p>
      {ready ? (
        <div className="mt-3 flex flex-col gap-3">
          <p className="flex items-start gap-1.5 text-[0.9375rem] text-ink-muted">
            <CheckCircle weight="bold" className="mt-1 size-4 flex-none text-accent" aria-hidden="true" />
            Ya recibe reservas. Compartí el link con tus clientes.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex h-12 items-center gap-2 rounded-[14px] bg-accent px-4 font-head text-base font-extrabold tracking-tight text-on-accent transition duration-200 hover:brightness-95 active:scale-[0.98]"
              onClick={() => window.open(`/${business.slug}`, '_blank', 'noopener')}
            >
              <ArrowSquareOut weight="bold" className="size-5" aria-hidden="true" />
              Abrir mi página
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center gap-2 rounded-[14px] border-2 border-on-ink px-4 font-head text-base font-extrabold tracking-tight text-on-ink transition duration-200 hover:bg-on-ink hover:text-ink active:scale-[0.98]"
              onClick={() => void copyLink()}
            >
              <Copy weight="bold" className="size-5" aria-hidden="true" />
              Copiar link
            </button>
            {copied ? (
              <span role="status" className="text-[0.9375rem] font-medium text-accent">
                Link copiado
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-1 flex items-start gap-1.5 text-[0.9375rem] text-ink-muted">
          <Clock weight="bold" className="mt-1 size-4 flex-none" aria-hidden="true" />
          Todavía no está activa: la abrimos cuando cargues tus servicios y horarios.
        </p>
      )}
    </div>
  )
}

export function PanelHome({ business, progress, onOpen }: PanelHomeProps) {
  const steps = buildSteps(progress)
  const pageReady = Boolean(progress && progress.serviceCount > 0 && progress.hasHours)

  return (
    <div className="grid items-start gap-10 md:grid-cols-[1.1fr_0.9fr] md:gap-16">
      <section className="rise-in flex flex-col gap-6 pt-2 md:pt-10" style={{ '--i': 0 } as CSSProperties}>
        <p className="font-head text-base font-extrabold tracking-tight text-link">Tu panel</p>
        <h1 className="text-[1.875rem] md:text-[2.75rem] md:leading-[1.05]">{business.name}</h1>
        <PageCard business={business} ready={pageReady} />
        <AppointmentsCard progress={progress} onOpen={() => onOpen('agenda')} />
      </section>

      <section className="rise-in flex flex-col" style={{ '--i': 1 } as CSSProperties} aria-labelledby="steps-title">
        <h2 id="steps-title" className="mb-2 text-[1.3125rem]">
          Para empezar a recibir turnos
        </h2>
        <ol className="divide-y-2 divide-line">
          {steps.map(({ title, detail, status, icon: Icon, action }) => (
            <li key={title} className="flex items-start gap-4 py-5">
              <span
                className={`mt-0.5 grid size-10 flex-none place-items-center rounded-[12px] ${status === 'done' ? 'bg-ok-bg text-ok' : 'bg-tint text-fg'}`}
              >
                <Icon weight="bold" className="size-5" aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2 font-head text-lg font-extrabold tracking-tight">
                  {title}
                  {status === 'loading' ? (
                    <span className="skeleton h-5 w-14 rounded-md" role="status" aria-label="Cargando" />
                  ) : (
                    <span className={`rounded-md px-2 py-0.5 text-[0.8125rem] font-bold tracking-normal ${BADGE[status].className}`}>
                      {BADGE[status].label}
                    </span>
                  )}
                </p>
                <p className="text-base text-muted">{detail}</p>
                {action ? (
                  <div className="pt-2">
                    <button type="button" className={SECONDARY_BUTTON} onClick={() => onOpen(action.view)}>
                      {action.label}
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
