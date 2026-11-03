import { CalendarCheck, CheckCircle, Clock, Scissors, WhatsappLogo } from '@phosphor-icons/react'
import type { CSSProperties } from 'react'
import type { Business } from '../lib/business.ts'
import { PAGE_ADDRESS_PREFIX } from '../lib/slug.ts'

interface Step {
  title: string
  detail: string
  done: boolean
  icon: typeof Clock
}

const STEPS: readonly Step[] = [
  { title: 'Tu negocio', detail: 'Ya cargaste el nombre, la dirección de tu página y tu WhatsApp.', done: true, icon: CheckCircle },
  { title: 'Servicios y horarios', detail: 'Qué ofrecés, cuánto dura y qué días atendés.', done: false, icon: Scissors },
  { title: 'Google Calendar', detail: 'Cada turno nuevo aparece en tu calendario.', done: false, icon: CalendarCheck },
  { title: 'WhatsApp', detail: 'Conectás tu número y elegís cuándo avisar a tus clientes.', done: false, icon: WhatsappLogo },
]

export function PanelHome({ business }: { business: Business }) {
  return (
    <div className="grid items-start gap-10 md:grid-cols-[1.1fr_0.9fr] md:gap-16">
      <section className="rise-in flex flex-col gap-6 pt-2 md:pt-10" style={{ '--i': 0 } as CSSProperties}>
        <p className="font-head text-base font-extrabold tracking-tight text-link">Tu panel</p>
        <h1 className="text-[1.875rem] md:text-[2.75rem] md:leading-[1.05]">{business.name}</h1>
        <div className="flex flex-col gap-1 rounded-[1.25rem] bg-ink p-5 text-on-ink">
          <p className="text-[0.9375rem] text-ink-muted">Tu página de reservas</p>
          <p className="break-all font-head text-xl font-extrabold tracking-tight">
            {PAGE_ADDRESS_PREFIX}
            {business.slug}
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-[0.9375rem] text-ink-muted">
            <Clock weight="bold" className="mt-1 size-4 flex-none" aria-hidden="true" />
            Todavía no está activa: la abrimos cuando cargues tus servicios y horarios.
          </p>
        </div>
      </section>

      <section className="rise-in flex flex-col" style={{ '--i': 1 } as CSSProperties} aria-labelledby="steps-title">
        <h2 id="steps-title" className="mb-2 text-[1.3125rem]">
          Para empezar a recibir turnos
        </h2>
        <ol className="divide-y-2 divide-line">
          {STEPS.map(({ title, detail, done, icon: Icon }) => (
            <li key={title} className="flex items-start gap-4 py-5">
              <span
                className={`mt-0.5 grid size-10 flex-none place-items-center rounded-[12px] ${done ? 'bg-ok-bg text-ok' : 'bg-tint text-fg'}`}
              >
                <Icon weight="bold" className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2 font-head text-lg font-extrabold tracking-tight">
                  {title}
                  <span
                    className={`rounded-md px-2 py-0.5 text-[0.8125rem] font-bold tracking-normal ${done ? 'bg-ok-bg text-ok' : 'bg-pend-bg text-pend'}`}
                  >
                    {done ? 'Listo' : 'Próximamente'}
                  </span>
                </p>
                <p className="text-base text-muted">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
