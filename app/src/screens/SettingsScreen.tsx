import { PushSettings } from '../components/PushSettings.tsx'
import { signOutWithPush } from '../lib/push.ts'
import { InstallPanel } from '../components/InstallPanel.tsx'
import { LegalLinks } from '../components/LegalLinks.tsx'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'
import { SECONDARY_BUTTON } from '../components/ui.ts'
export function SettingsScreen({ businessId }: { businessId: string }) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data, error }) => { if (active) { setSession(data.session); if (error) setError('No pudimos leer tu cuenta.') } })
    return () => { active = false }
  }, [])
  async function signOut() { const { error } = await signOutWithPush(); if (error) setError('No pudimos cerrar la sesión. Probá nuevamente.') }
  return <section className="settings-screen max-w-2xl"><p className="eyebrow">Ajustes</p><h1 className="screen-title">Tu cuenta, a mano.</h1>
    <div className="settings-sections divide-y divide-line">
      <section className="settings-section"><h2 className="text-xl">Tu cuenta de Google</h2><p className="break-words text-muted">{session?.user.email ?? 'Cargando tu cuenta…'}</p><button className={SECONDARY_BUTTON} onClick={() => void signOut()}>Cerrar sesión</button></section>
      <section className="settings-section"><h2 className="text-xl">¿Necesitás una mano?</h2><p className="text-muted">Podés escribirnos por consultas sobre tu cuenta o tus reservas.</p><button className={SECONDARY_BUTTON} onClick={() => { window.location.href = 'mailto:cale.turnos@gmail.com' }}>Contactar a Cale</button></section>
      <section className="settings-section"><h2 className="text-xl">Notificaciones</h2><PushSettings businessId={businessId} /></section>
      <section className="settings-section"><h2 className="text-xl">Instalar Cale</h2><InstallPanel /></section>
      <section className="settings-section"><h2 className="text-xl">Borrar mis datos</h2><p className="text-muted">El borrado inmediato desde el panel se incorpora antes de abrir Cale a negocios reales. Mientras tanto podés solicitarlo al contacto de ayuda.</p></section>
      <section className="settings-section"><h2 className="text-xl">Privacidad y condiciones</h2><LegalLinks /></section>
    </div>{error && <p role="alert" className="text-warn">{error}</p>}
  </section>
}
