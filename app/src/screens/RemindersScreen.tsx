import { useState } from 'react'
import { ReminderExample } from '../components/ReminderExample.tsx'
import type { Business } from '../lib/business.ts'
import { REMINDER_OPTIONS, type ReminderHours } from '../lib/onboarding.ts'
import { PreferencesError, savePreferences, type Preferences } from '../lib/preferences.ts'
import { PRIMARY_BUTTON } from '../components/ui.ts'

export function RemindersScreen({ business, preferences, onSaved, onboarding = false }: {
  business: Business; preferences: Preferences; onSaved: (value: Preferences) => void; onboarding?: boolean
}) {
  const [hours, setHours] = useState<ReminderHours>(preferences.reminder_hours)
  const [waitlist, setWaitlist] = useState(preferences.whatsapp_waitlist)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  async function save() {
    setBusy(true); setError(''); setSaved(false)
    const value = { ...preferences, reminder_hours: hours, whatsapp_waitlist: waitlist, reminders_reviewed: true }
    try { await savePreferences(value); setSaved(true); onSaved(value) }
    catch (cause) { if (!(cause instanceof PreferencesError)) throw cause; setError(cause.message) }
    finally { setBusy(false) }
  }
  return <section className="warm-split">
    <div className="flex flex-col gap-5">
      <p className="eyebrow">Recordatorios · Próximamente</p>
      <h1 className="screen-title">Un recordatorio,<br />menos olvidos.</h1>
      <p className="max-w-md text-lg text-muted">Tus clientes van a recibir el aviso desde el WhatsApp que ya usás en tu negocio.</p>
      <p className="rounded-xl bg-tint p-4 text-sm">Todavía no se envían mensajes. Estamos preparando la conexión con WhatsApp.</p>
    </div>
    <div className="flex flex-col gap-6">
      <ReminderExample businessName={business.name} />
      <fieldset><legend className="mb-3 font-semibold">¿Cuánto antes querés avisar?</legend>
        <div className="grid grid-cols-3 gap-2">{REMINDER_OPTIONS.map(option => <button type="button" key={option} aria-pressed={hours === option} className={`choice-button ${hours === option ? 'selected' : ''}`} onClick={() => { setHours(option); setSaved(false) }}>{option} h antes</button>)}</div>
      </fieldset>
      <label className="flex cursor-pointer items-start gap-3 text-base"><input type="checkbox" checked={waitlist} onChange={event => { setWaitlist(event.target.checked); setSaved(false) }} className="mt-1 size-5 accent-[var(--link)]" />Quiero sumarme a la lista de espera de WhatsApp.</label>
      <p className="text-sm text-muted">Guardamos tu preferencia. Sumarte no conecta tu número ni activa los envíos.</p>
      {error && <p role="alert" className="text-warn">{error}</p>}
      {saved && <p role="status" className="text-link">Preferencias guardadas.</p>}
      <button className={PRIMARY_BUTTON} disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : onboarding ? 'Guardar y continuar' : 'Guardar preferencias'}</button>
      {!onboarding && <section className="mt-5 border-t border-line pt-5"><h2 className="text-xl">Avisos para tu negocio</h2><p className="mt-2 text-muted">Próximamente: turnos nuevos, cancelaciones y un resumen del día mediante notificaciones. Vienen apagadas hasta que las actives.</p></section>}
    </div>
  </section>
}
