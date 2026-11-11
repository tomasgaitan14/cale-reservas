import { PushSettings } from '../components/PushSettings.tsx'
import { signOutWithPush } from '../lib/push.ts'
import { InstallPanel } from '../components/InstallPanel.tsx'
import { LegalLinks } from '../components/LegalLinks.tsx'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'
import { SECONDARY_BUTTON } from '../components/ui.ts'
import { Crown, ArrowRight, Clock } from '@phosphor-icons/react'
import type { Business } from '../lib/business.ts'
import { cancelProSubscription, PRO_CHECKOUT_ENABLED, startProSubscription } from '../lib/billing.ts'
import { Modal } from '../components/Modal.tsx'
import { TextField } from '../components/TextField.tsx'
import { deleteAccount } from '../lib/account.ts'

const DELETE_BUTTON = 'inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-warn px-4 font-head text-base font-extrabold tracking-tight text-on-ink transition duration-200 hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'
export function SettingsScreen({ business }: { business: Business }) {
  const isPro = business.plan === 'pro'
  const canManage = business.role === 'owner' || business.role === 'admin'
  const isCanceled = isPro && business.billing_status === 'canceled'
  const isPending = !isPro && business.billing_status === 'pending'
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [billingBusy, setBillingBusy] = useState(false)
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null)
  const [billingDay, setBillingDay] = useState(10)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data, error }) => { if (active) { setSession(data.session); if (error) setError('No pudimos leer tu cuenta.') } })
    supabase.from('business_billing').select('current_period_end, billing_day').eq('business_id', business.id).maybeSingle().then(({ data, error }) => {
      if (!active) return
      if (error) { setError('No pudimos leer el período de facturación.'); return }
      setNextBillingDate(data?.current_period_end ?? null)
      setBillingDay(data?.billing_day ?? 10)
    })
    return () => { active = false }
  }, [])
  async function signOut() { const { error } = await signOutWithPush(); if (error) setError('No pudimos cerrar la sesión. Probá nuevamente.') }
  async function upgradeToPro() {
    setBillingBusy(true); setError('')
    try { window.location.assign(await startProSubscription(business.id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos iniciar la suscripción. Probá nuevamente.'); setBillingBusy(false) }
  }
  function formatBillingDate(value: string) {
    return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Cordoba' }).format(new Date(value))
  }
  function remainingDays(value: string | null) {
    if (!value) return null
    const difference = Date.parse(value) - Date.now()
    return difference > 0 ? Math.ceil(difference / 86_400_000) : 0
  }
  const canceledRemainingDays = isCanceled ? remainingDays(nextBillingDate ?? business.current_period_end ?? null) : null
  async function downgradeFromPro() {
    setCancelBusy(true); setError('')
    try { await cancelProSubscription(business.id); window.location.reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos dar de baja Pro. Probá nuevamente.'); setCancelBusy(false) }
  }
  function closeDelete() {
    if (deleteBusy) return
    setDeleteOpen(false); setDeleteConfirmation(''); setDeleteError('')
  }
  async function removeAccount() {
    if (deleteConfirmation !== 'ELIMINAR') return
    setDeleteBusy(true); setDeleteError('')
    try { await deleteAccount(); window.location.assign('/') }
    catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'No pudimos eliminar tu cuenta. Probá nuevamente.'); setDeleteBusy(false) }
  }
  return <section className="settings-screen max-w-5xl">
    <p className="eyebrow">Ajustes</p>
    <h1 className="screen-title">Tu cuenta, a mano.</h1>
    <div className="settings-sections">
      <section className="settings-section">
        <h2 className="text-xl">Tu cuenta de Google</h2>
        <p className="break-words text-muted">{session?.user.email ?? 'Cargando tu cuenta…'}</p>
        <button className={SECONDARY_BUTTON} onClick={() => void signOut()}>Cerrar sesión</button>
      </section>
      {canManage ? <section className="settings-section">
        <div className={`natural-settings-plan-card flex flex-wrap items-start justify-between gap-5 rounded-2xl p-5 ${isCanceled ? 'is-canceled' : isPro ? 'is-pro' : isPending ? 'is-pending' : 'is-free'}`}>
          <div className="flex items-start gap-3">
            {isPending ? <Clock size={25} weight="bold" className="settings-plan-accent-pro mt-0.5" aria-hidden="true" /> : <Crown size={25} weight="bold" className={`mt-0.5 ${isPro ? 'settings-plan-accent-pro' : 'text-warn'}`} aria-hidden="true" />}
            <div>
              <p className={`text-sm font-semibold uppercase tracking-[0.08em] ${isPro || isPending ? 'settings-plan-accent-pro' : 'text-warn'}`}>Plan actual</p>
              <h2 className="mt-1 text-2xl">{isPending ? 'Procesando pago' : isCanceled ? 'Pro cancelado' : business.plan === 'pro' ? 'Pro' : business.plan === 'enterprise' ? 'Enterprise' : 'Gratis'}</h2>
              <p className="mt-2 max-w-md text-muted">{isPending ? 'Mercado Pago recibió tu pago y estamos confirmando la suscripción. Puede demorar hasta 2 minutos. No vuelvas a pagar.' : isCanceled ? 'No se realizarán nuevos cobros. Conservás Pro hasta el final de tu período actual.' : 'Tu agenda, reservas, notificaciones y personalización están disponibles sin vencimiento. Las funciones automáticas de WhatsApp estarán disponibles próximamente.'}</p>
              {isPro ? <div className="mt-3 space-y-1 text-sm font-semibold text-ink">
                {isCanceled ? <><p>Baja confirmada.</p>{nextBillingDate && <p>Tu acceso Pro termina el {formatBillingDate(nextBillingDate)}.</p>}{canceledRemainingDays !== null && <p>Te quedan {canceledRemainingDays} {canceledRemainingDays === 1 ? 'día' : 'días'} de Pro.</p>}</> : <><p>Suscripción activa.</p>{nextBillingDate && <><p>Próxima facturación: {formatBillingDate(nextBillingDate)}.</p><p>Luego, el día {billingDay} de cada mes.</p></>}</>}
              </div> : null}
            </div>
          </div>
          {isPro && !isCanceled ? <button type="button" className={`${SECONDARY_BUTTON} shrink-0`} onClick={() => setCancelOpen(true)} disabled={cancelBusy}>{cancelBusy ? 'Dando de baja…' : 'Dar de baja Pro'}</button> : PRO_CHECKOUT_ENABLED && !isPro && !isPending ? <button type="button" className={`${SECONDARY_BUTTON} shrink-0`} onClick={() => void upgradeToPro()} disabled={billingBusy}>{billingBusy ? 'Preparando pago…' : 'Mejorar a Pro'}{!billingBusy && <ArrowRight size={18} aria-hidden="true" />}</button> : null}
        </div>
      </section> : null}
      <section className="settings-section"><h2 className="text-xl">¿Necesitás una mano?</h2><p className="text-muted">Podés escribirnos por consultas sobre tu cuenta o tus reservas.</p><button className={SECONDARY_BUTTON} onClick={() => { window.location.href = 'mailto:cale.turnos@gmail.com' }}>Contactar a Cale</button></section>
      <section className="settings-section"><h2 className="text-xl">Notificaciones</h2><PushSettings businessId={business.id} /></section>
      <section className="settings-section"><h2 className="text-xl">Instalar Cale</h2><InstallPanel /></section>
      {canManage ? <section className="settings-section"><h2 className="text-xl">Eliminar cuenta y datos</h2><p className="text-muted">Eliminá tu cuenta, tu negocio, turnos, horarios, preferencias, logos y demás datos asociados de Cale.</p><button type="button" className={DELETE_BUTTON} onClick={() => { setDeleteError(''); setDeleteOpen(true) }}>Eliminar mi cuenta</button></section> : null}
      <section className="settings-section"><h2 className="text-xl">Privacidad y condiciones</h2><LegalLinks /></section>
    </div>
    {error && <p role="alert" className="text-warn">{error}</p>}
    {deleteOpen && <Modal title="Eliminar cuenta y datos" onClose={closeDelete}>
      <div className="flex flex-col gap-4"><p>Esta acción eliminará de forma permanente tu cuenta de acceso, negocio, turnos, horarios, notificaciones, facturación y logos.</p><p className="font-semibold text-warn">No se puede deshacer.</p><TextField id="delete-confirmation" label="Escribí ELIMINAR para confirmar" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} autoComplete="off" autoFocus disabled={deleteBusy} error={deleteError || null} /><div className="flex flex-wrap justify-end gap-3"><button type="button" className={SECONDARY_BUTTON} onClick={closeDelete} disabled={deleteBusy}>Cancelar</button><button type="button" className={DELETE_BUTTON} onClick={() => void removeAccount()} disabled={deleteBusy || deleteConfirmation !== 'ELIMINAR'}>{deleteBusy ? 'Eliminando…' : 'Eliminar todo'}</button></div></div>
    </Modal>}
    {cancelOpen && <Modal title="Dar de baja Pro" onClose={() => { if (!cancelBusy) setCancelOpen(false) }}>
      <div className="flex flex-col gap-4"><p>La suscripción se cancelará en Mercado Pago y no se generarán nuevos cobros.</p><p>Vas a conservar Pro hasta el final del período que ya pagaste. Después, tu negocio volverá a Gratis.</p><p className="font-semibold text-warn">Esta acción detendrá los próximos cobros.</p><div className="flex flex-wrap justify-end gap-3"><button type="button" className={SECONDARY_BUTTON} onClick={() => setCancelOpen(false)} disabled={cancelBusy}>Conservar Pro</button><button type="button" className={DELETE_BUTTON} onClick={() => void downgradeFromPro()} disabled={cancelBusy}>{cancelBusy ? 'Cancelando…' : 'Confirmar baja'}</button></div></div>
    </Modal>}
  </section>
}
