import { useEffect, useState, type FormEvent } from 'react'
import type { Business } from '../lib/business.ts'
import { supabase } from '../lib/supabase.ts'
import { describeCreateBusinessError, type BusinessFormErrors } from '../lib/business-errors.ts'
import { cleanSlugInput, MAX_SLUG_LENGTH, pageAddressPrefix } from '../lib/slug.ts'
import { normalizeWhatsapp } from '../lib/whatsapp.ts'
import { TextField } from '../components/TextField.tsx'
import { ShareBooking } from '../components/ShareBooking.tsx'
import { PRIMARY_BUTTON } from '../components/ui.ts'
import { fetchBusinessMetrics, type BusinessMetrics } from '../lib/business-metrics.ts'

export function BusinessScreen({ business, ready, onChanged }: {
  business: Business; ready: boolean; onChanged: (value: Business) => void; onServices?: () => void; onHours?: () => void; onProfessionals?: () => void; onBranding?: () => void; preferences?: unknown; onPreferencesChanged?: unknown
}) {
  const canManage = !business.role || business.role === 'owner' || business.role === 'admin'
  const [name, setName] = useState(business.name)
  const [slug, setSlug] = useState(business.slug)
  const [phone, setPhone] = useState(business.whatsapp)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<BusinessFormErrors>({})
  const [notice, setNotice] = useState('')
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null)
  useEffect(() => { let active = true; void fetchBusinessMetrics(business.id).then(value => { if (active) setMetrics(value) }).catch(() => { if (active) setMetrics(null) }); return () => { active = false } }, [business.id])
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
    <section className="business-metrics" aria-labelledby="business-metrics-title"><div><p className="eyebrow">Resumen</p><h2 id="business-metrics-title">Cómo viene tu negocio</h2></div>{metrics ? <div className="business-metrics-grid"><div><span>Próximos turnos</span><strong>{metrics.upcomingAppointments}</strong></div><div><span>Turnos este mes</span><strong>{metrics.monthAppointments}</strong></div><div><span>Clientes registrados</span><strong>{metrics.clients}</strong></div></div> : <p className="text-muted">Cargando métricas…</p>}</section>
    <form onSubmit={submit} className="warm-form">
      <h2 className="text-2xl">Datos del negocio</h2>
      <TextField id="edit-business-name" label="Nombre" value={name} maxLength={80} required onChange={event => setName(event.target.value)} error={errors.name} />
      <TextField id="edit-business-slug" label="Dirección de tu página" preview={`${pageAddressPrefix()}${slug}`} value={slug} maxLength={MAX_SLUG_LENGTH} required onChange={event => setSlug(cleanSlugInput(event.target.value))} error={errors.slug} hint="Si cambiás la dirección, el link anterior deja de funcionar." />
      <TextField id="edit-business-whatsapp" label="WhatsApp de contacto público" hint="Se muestra en tu página de reservas para consultas, cambios o cancelaciones." type="tel" value={phone} required onChange={event => setPhone(event.target.value)} error={errors.whatsapp} />
      {errors.general && <p role="alert" className="text-warn">{errors.general}</p>}{notice && <p role="status" className="text-link">{notice}</p>}
      <button className={PRIMARY_BUTTON} disabled={busy}>{busy ? 'Guardando…' : 'Guardar datos'}</button>
    </form>
    {ready ? <ShareBooking business={business} /> : <p className="rounded-xl bg-tint p-5">Tu link y QR van a aparecer cuando tengas al menos un servicio activo y horarios.</p>}
  </div>
}
