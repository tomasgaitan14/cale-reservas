import { BusinessBranding } from '../components/BusinessBranding.tsx'
import { useState, type FormEvent } from 'react'
import type { Business } from '../lib/business.ts'
import { supabase } from '../lib/supabase.ts'
import { describeCreateBusinessError, type BusinessFormErrors } from '../lib/business-errors.ts'
import { cleanSlugInput, MAX_SLUG_LENGTH, pageAddressPrefix } from '../lib/slug.ts'
import { normalizeWhatsapp } from '../lib/whatsapp.ts'
import { TextField } from '../components/TextField.tsx'
import { ShareBooking } from '../components/ShareBooking.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'
import { defaultPreferences, savePreferences, type Preferences } from '../lib/preferences.ts'

export function BusinessScreen({ business, ready, preferences, onPreferencesChanged, onChanged, onServices, onHours, onProfessionals, onBranding }: {
  business: Business; ready: boolean; preferences?: Preferences; onPreferencesChanged?: (value: Preferences) => void; onChanged: (value: Business) => void; onServices: () => void; onHours: () => void; onProfessionals?: () => void; onBranding?: () => void
}) {
  const canManage = !business.role || business.role === 'owner' || business.role === 'admin'
  const currentPreferences = preferences ?? defaultPreferences(business.id)
  const [name, setName] = useState(business.name)
  const [slug, setSlug] = useState(business.slug)
  const [phone, setPhone] = useState(business.whatsapp)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<BusinessFormErrors>({})
  const [notice, setNotice] = useState('')
  const [overlapBusy, setOverlapBusy] = useState(false)
  const [overlapError, setOverlapError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setErrors({}); setNotice('')
    const value = { name: name.trim(), slug, whatsapp: normalizeWhatsapp(phone) }
    const { data, error } = await supabase.from('businesses').update(value).eq('id', business.id).select('id, name, slug, whatsapp').single()
    setBusy(false)
    if (error) setErrors(describeCreateBusinessError(error))
    else { onChanged(data); setNotice('Datos guardados.') }
  }
  if (!canManage) return <section className="flex max-w-2xl flex-col gap-5 pt-2 md:pt-6"><p className="eyebrow">Tu acceso</p><h1 className="screen-title">Tu agenda, en orden.</h1><p className="text-lg text-muted">Tu cuenta está configurada como profesional. Desde Agenda vas a ver únicamente los turnos de los servicios que tenés asignados.</p><div className="rounded-2xl bg-tint p-5"><p className="font-head text-lg font-extrabold tracking-tight">¿Necesitás cambiar un servicio?</p><p className="mt-2 text-muted">Pedile a la administración del negocio que te asigne o actualice los servicios.</p></div></section>
  return <div className="flex flex-col gap-10">
    <div><p className="eyebrow">Tu negocio</p><h1 className="screen-title">Todo a tu manera.</h1><p className="mt-3 text-muted">Los datos y la disponibilidad que ven tus clientes.</p></div>
    <div className="warm-split"><form onSubmit={submit} className="warm-form">
      <h2 className="text-2xl">Datos del negocio</h2>
      <TextField id="edit-business-name" label="Nombre" value={name} maxLength={80} required onChange={event => setName(event.target.value)} error={errors.name} />
      <TextField id="edit-business-slug" label="Dirección de tu página" preview={`${pageAddressPrefix()}${slug}`} value={slug} maxLength={MAX_SLUG_LENGTH} required onChange={event => setSlug(cleanSlugInput(event.target.value))} error={errors.slug} hint="Si cambiás la dirección, el link anterior deja de funcionar." />
      <TextField id="edit-business-whatsapp" label="WhatsApp de contacto público" hint="Se muestra en tu página de reservas para consultas, cambios o cancelaciones." type="tel" value={phone} required onChange={event => setPhone(event.target.value)} error={errors.whatsapp} />
      {errors.general && <p role="alert" className="text-warn">{errors.general}</p>}{notice && <p role="status" className="text-link">{notice}</p>}
      <button className={PRIMARY_BUTTON} disabled={busy}>{busy ? 'Guardando…' : 'Guardar datos'}</button>
    </form><div className="business-management-list">
      <section className="business-management-section"><h2 className="text-2xl">Tus servicios</h2><p className="my-4 text-muted">Qué ofrecés, cuánto dura y qué servicios están disponibles.</p><button className={SECONDARY_BUTTON} onClick={onServices}>Editar servicios</button></section>
      <section className="business-management-section"><h2 className="text-2xl">Tus horarios</h2><p className="my-4 text-muted">Días de atención, descansos y horarios de cada semana.</p><button className={SECONDARY_BUTTON} onClick={onHours}>Editar horarios</button></section>
      <section className="business-management-section"><h2 className="text-2xl">Tus profesionales</h2><p className="my-4 text-muted">Servicios asignados, permisos y acceso de cada persona de tu equipo.</p><button className={SECONDARY_BUTTON} onClick={() => onProfessionals?.()}>Editar profesionales</button></section>
      <section className="business-management-section"><h2 className="text-2xl">Página y colores</h2><p className="my-4 text-muted">Personalizá el logo y los colores que ven tus clientes al reservar.</p><button className={SECONDARY_BUTTON} onClick={() => onBranding?.()}>Editar página</button></section>
      <section className="business-management-section"><h2 className="text-2xl">Agenda del equipo</h2><p className="my-4 text-muted">Definí si dos profesionales pueden tener turnos en el mismo horario.</p><label className="flex items-start gap-3 text-base"><input type="checkbox" className="mt-1 size-5 accent-[var(--color-link)]" checked={currentPreferences.allow_cross_professional_overlap} disabled={overlapBusy} onChange={async event => {
        const next = event.target.checked
        const previous = currentPreferences
        setOverlapError(''); setOverlapBusy(true); onPreferencesChanged?.({ ...previous, allow_cross_professional_overlap: next })
        try { await savePreferences({ ...previous, allow_cross_professional_overlap: next }) }
        catch (cause) { onPreferencesChanged?.(previous); setOverlapError(cause instanceof Error ? cause.message : 'No pudimos guardar este ajuste.') }
        finally { setOverlapBusy(false) }
      }} /><span><strong>Superponer turnos entre profesionales</strong><span className="mt-1 block text-sm text-muted">Si está activo, cada profesional puede recibir turnos simultáneos. Si lo desactivás, Cale reservará un solo turno por horario en todo el negocio.</span></span></label>{overlapError && <p role="alert" className="mt-3 text-warn">{overlapError}</p>}</section>
    </div></div>
    {ready ? <ShareBooking business={business} /> : <p className="rounded-xl bg-tint p-5">Tu link y QR van a aparecer cuando tengas al menos un servicio activo y horarios.</p>}
  </div>
}
