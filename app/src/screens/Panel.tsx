import { signOutWithPush } from '../lib/push.ts'
import { InstallPanel } from '../components/InstallPanel.tsx'
import { useCallback, useEffect, useState } from 'react'
import { Bell, CalendarBlank, GearSix, Storefront } from '@phosphor-icons/react'
import type { Business } from '../lib/business.ts'
import { fetchSetupProgress, SetupLoadError, type SetupProgress } from '../lib/setup.ts'
import { fetchPreferences, PreferencesError, savePreferences, type Preferences } from '../lib/preferences.ts'
import { nextSetupStep, SETUP_STEPS } from '../lib/onboarding.ts'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'
import { Brand } from '../components/Brand.tsx'
import { Shell } from '../components/Shell.tsx'
import { supabase } from '../lib/supabase.ts'
import { ShareBooking } from '../components/ShareBooking.tsx'
import { AgendaScreen } from './AgendaScreen.tsx'
import { BusinessScreen } from './BusinessScreen.tsx'
import { HoursScreen } from './HoursScreen.tsx'
import { ServicesScreen } from './ServicesScreen.tsx'
import { RemindersScreen } from './RemindersScreen.tsx'
import { SettingsScreen } from './SettingsScreen.tsx'

type Tab = 'agenda' | 'business' | 'reminders' | 'settings'
const TABS = [
  { key: 'agenda', path: '/panel', label: 'Agenda', icon: CalendarBlank },
  { key: 'business', path: '/panel/negocio', label: 'Negocio', icon: Storefront },
  { key: 'reminders', path: '/panel/avisos', label: 'Avisos', icon: Bell },
  { key: 'settings', path: '/panel/ajustes', label: 'Ajustes', icon: GearSix },
] as const
function currentTab(): Tab { return TABS.find(tab => tab.path === window.location.pathname.replace(/\/+$/, ''))?.key ?? 'agenda' }

export function Panel({ business: initialBusiness }: { business: Business }) {
  const [business, setBusiness] = useState(initialBusiness)
  const [tab, setTab] = useState<Tab>(currentTab)
  const [editor, setEditor] = useState<'services' | 'hours' | null>(null)
  const [progress, setProgress] = useState<SetupProgress | null>(null)
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [error, setError] = useState('')
  const [skipped, setSkipped] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const refresh = useCallback(() => {
    setError('')
    void Promise.all([fetchSetupProgress(initialBusiness.id), fetchPreferences(initialBusiness.id)])
      .then(([loadedProgress, loadedPreferences]) => { setProgress(loadedProgress); setPreferences(loadedPreferences) })
      .catch((cause: unknown) => {
        if (!(cause instanceof SetupLoadError || cause instanceof PreferencesError)) throw cause
        setError('No pudimos cargar tu configuración. Si acabamos de actualizar Cale, verificá que la base esté actualizada y probá de nuevo.')
      })
  }, [initialBusiness.id])
  useEffect(refresh, [refresh])
  useEffect(() => {
    const onPop = () => { setTab(currentTab()); setEditor(null) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  function navigate(next: Tab) {
    const path = TABS.find(item => item.key === next)!.path
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
    setTab(next); setEditor(null); refresh()
  }
  async function finish() {
    if (!preferences) return
    setFinishing(true); setError('')
    try {
      const value = { ...preferences, onboarding_completed: true }
      await savePreferences(value); setPreferences(value); navigate('agenda')
    } catch (cause) { if (!(cause instanceof PreferencesError)) throw cause; setError(cause.message) }
    finally { setFinishing(false) }
  }
  if (!preferences || !progress) return <Shell><section className="py-10">
    {error ? <><h1 className="text-2xl">No pudimos abrir tu panel</h1><p role="alert" className="my-5 text-muted">{error}</p><button className={SECONDARY_BUTTON} onClick={refresh}>Reintentar</button></> : <div className="skeleton h-64 rounded-2xl" role="status" aria-label="Cargando tu panel" />}
  </section></Shell>
  const step = nextSetupStep(progress.serviceCount, progress.hasHours, preferences.reminders_reviewed)
  const ready = progress.serviceCount > 0 && progress.hasHours
  const wizard = !preferences.onboarding_completed && !skipped
  const stepNumber = { services: 3, hours: 4, reminders: 5, ready: 6 }[step]
  if (wizard) return <Shell onSignOut={() => { void signOutWithPush().then(({ error }) => { if (error) window.alert(error.message) }) }}><div className="flex flex-col gap-8">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
      <p className="font-semibold text-link">Paso {stepNumber} de 6</p>
      <button className={SECONDARY_BUTTON} onClick={() => setSkipped(true)}>Seguir después</button>
    </div>
    <ol aria-label="Pasos de configuración" className="setup-progress">{SETUP_STEPS.map((label, index) => <li key={label} aria-current={index + 1 === stepNumber ? 'step' : undefined} className={index + 1 <= stepNumber ? 'text-link' : 'text-muted'}><span>{index + 1}</span>{label}</li>)}</ol>
    {error && <p role="alert" className="text-warn">{error}</p>}
    {step === 'services' && <ServicesScreen business={business} onBack={() => setSkipped(true)} onContinue={refresh} />}
    {step === 'hours' && <HoursScreen business={business} onBack={() => setSkipped(true)} onContinue={refresh} />}
    {step === 'reminders' && <RemindersScreen business={business} preferences={preferences} onboarding onSaved={setPreferences} />}
    {step === 'ready' && <><div><p className="eyebrow">Todo listo</p><h1 className="screen-title">Tu agenda ya tiene su lugar.</h1><p className="mt-3 text-lg text-muted">Tu página puede recibir reservas. WhatsApp se activa más adelante.</p></div><ShareBooking business={business} /><button className={`${PRIMARY_BUTTON} md:max-w-xs md:self-end`} disabled={finishing} onClick={() => void finish()}>{finishing ? 'Guardando…' : 'Ir a mi agenda'}</button></>}
  </div></Shell>
  return <div className="natural-panel">
    <header className="natural-panel-header"><Brand /><nav aria-label="Secciones del panel" className="panel-nav">{TABS.map(({ key, label, icon: Icon }) => <button type="button" key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={22} aria-hidden="true" />{label}</button>)}</nav><button className="natural-business-button" onClick={() => navigate('business')}><Storefront size={22} aria-hidden="true" /><span>{business.name}</span></button></header><main className="natural-panel-main">
    {!preferences.onboarding_completed && <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-tint p-5"><p>Terminemos de preparar tu negocio. Retomás donde lo dejaste.</p><button className={SECONDARY_BUTTON} onClick={() => setSkipped(false)}>Continuar configuración</button></div>}
    {error && <p role="alert" className="text-warn">{error}</p>}
    {preferences.onboarding_completed && !ready && <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-tint p-5" role="status"><p>{progress.serviceCount < 1 ? 'Tu página necesita al menos un servicio activo para recibir reservas.' : 'Cargá tus horarios para que tu página pueda recibir reservas.'}</p><button className={SECONDARY_BUTTON} onClick={() => { navigate('business'); setEditor(progress.serviceCount < 1 ? 'services' : 'hours') }}>{progress.serviceCount < 1 ? 'Revisar servicios' : 'Cargar horarios'}</button></div>}
    {preferences.onboarding_completed && tab === 'agenda' && !editor && <InstallPanel invitation />}
    {tab === 'agenda'  && <AgendaScreen business={business} aside={ready ? <ShareBooking business={business} compact /> : undefined} />}
    {tab === 'business' && (editor === 'services' ? <ServicesScreen business={business} onBack={() => { setEditor(null); refresh() }} /> : editor === 'hours' ? <HoursScreen business={business} onBack={() => { setEditor(null); refresh() }} /> : <BusinessScreen business={business} ready={ready} onChanged={setBusiness} onServices={() => setEditor('services')} onHours={() => setEditor('hours')} />)}
    {tab === 'reminders' && <RemindersScreen business={business} preferences={preferences} onSaved={setPreferences} />}
    {tab === 'settings' && <SettingsScreen businessId={business.id} />}
  </main></div>
}
