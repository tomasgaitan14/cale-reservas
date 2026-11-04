import { BusinessBranding } from '../components/BusinessBranding.tsx'
import { useState, type FormEvent } from 'react'
import type { Business } from '../lib/business.ts'
import { supabase } from '../lib/supabase.ts'
import { describeCreateBusinessError, type BusinessFormErrors } from '../lib/business-errors.ts'
import { cleanSlugInput, MAX_SLUG_LENGTH, PAGE_ADDRESS_PREFIX } from '../lib/slug.ts'
import { normalizeWhatsapp } from '../lib/whatsapp.ts'
import { TextField } from '../components/TextField.tsx'
import { ShareBooking } from '../components/ShareBooking.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'

export function BusinessScreen({ business, ready, onChanged, onServices, onHours }: {
  business: Business; ready: boolean; onChanged: (value: Business) => void; onServices: () => void; onHours: () => void
}) {
  const [name, setName] = useState(business.name)
  const [slug, setSlug] = useState(business.slug)
  const [phone, setPhone] = useState(business.whatsapp)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<BusinessFormErrors>({})
  const [notice, setNotice] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setErrors({}); setNotice('')
    const value = { name: name.trim(), slug, whatsapp: normalizeWhatsapp(phone) }
    const { data, error } = await supabase.from('businesses').update(value).eq('id', business.id).select('id, name, slug, whatsapp').single()
    setBusy(false)
    if (error) setErrors(describeCreateBusinessError(error))
    else { onChanged(data); setNotice('Datos guardados.') }
  }
  return <div className="flex flex-col gap-10">
    <div><p className="eyebrow">Tu negocio</p><h1 className="screen-title">Todo a tu manera.</h1><p className="mt-3 text-muted">Los datos y la disponibilidad que ven tus clientes.</p></div>
    <div className="warm-split"><form onSubmit={submit} className="warm-form">
      <h2 className="text-2xl">Datos del negocio</h2>
      <TextField id="edit-business-name" label="Nombre" value={name} maxLength={80} required onChange={event => setName(event.target.value)} error={errors.name} />
      <TextField id="edit-business-slug" label="Dirección de tu página" preview={`${PAGE_ADDRESS_PREFIX}${slug}`} value={slug} maxLength={MAX_SLUG_LENGTH} required onChange={event => setSlug(cleanSlugInput(event.target.value))} error={errors.slug} hint="Si cambiás la dirección, el link anterior deja de funcionar." />
      <TextField id="edit-business-whatsapp" label="WhatsApp de contacto público" hint="Se muestra en tu página de reservas para consultas, cambios o cancelaciones." type="tel" value={phone} required onChange={event => setPhone(event.target.value)} error={errors.whatsapp} />
      {errors.general && <p role="alert" className="text-warn">{errors.general}</p>}{notice && <p role="status" className="text-link">{notice}</p>}
      <button className={PRIMARY_BUTTON} disabled={busy}>{busy ? 'Guardando…' : 'Guardar datos'}</button>
    </form><div className="flex flex-col divide-y divide-line">
      <section className="pb-6"><h2 className="text-2xl">Tus servicios</h2><p className="my-3 text-muted">Qué ofrecés, cuánto dura y qué servicios están disponibles.</p><button className={SECONDARY_BUTTON} onClick={onServices}>Editar servicios</button></section>
      <section className="py-6"><h2 className="text-2xl">Tus horarios</h2><p className="my-3 text-muted">Días de atención, descansos y horarios de cada semana.</p><button className={SECONDARY_BUTTON} onClick={onHours}>Editar horarios</button></section>
    </div></div>
    <BusinessBranding businessId={business.id} name={business.name} />
    {ready ? <ShareBooking business={business} /> : <p className="rounded-xl bg-tint p-5">Tu link y QR van a aparecer cuando tengas al menos un servicio activo y horarios.</p>}
  </div>
}
