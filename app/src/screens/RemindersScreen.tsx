import { Clock, WhatsappLogo } from '@phosphor-icons/react'
import { ReminderExample } from '../components/ReminderExample.tsx'
import type { Business } from '../lib/business.ts'

export function RemindersScreen({ business }: { business: Business }) {
  return <section className="warm-split">
    <div className="flex flex-col gap-5">
      <p className="eyebrow">Avisos · Próximamente</p>
      <h1 className="screen-title">Recordatorios que<br />ayudan a llegar.</h1>
      <p className="max-w-md text-lg text-muted">Estamos preparando la conexión con WhatsApp para que tus clientes reciban avisos automáticos antes de sus turnos.</p>
    </div>
    <div className="flex flex-col gap-6">
      <ReminderExample businessName={business.name} />
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-tint p-5">
        <span className="grid size-11 place-items-center rounded-xl bg-surface text-link"><WhatsappLogo size={24} weight="fill" aria-hidden="true" /></span>
        <div><h2 className="text-2xl">WhatsApp · Próximamente</h2><p className="mt-2 text-muted">La vista previa muestra cómo funcionará. Todavía no se envían mensajes ni se puede configurar la anticipación.</p></div>
        <p className="flex items-center gap-2 text-sm font-semibold text-link"><Clock size={17} aria-hidden="true" />Te avisaremos cuando esté disponible.</p>
      </div>
    </div>
  </section>
}
