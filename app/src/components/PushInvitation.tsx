import { useEffect, useState } from 'react'
import { Bell } from '@phosphor-icons/react'
import { panelDisplayMode } from './InstallPanel.tsx'
import { Modal } from './Modal.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './ui.ts'
import { enablePush, pushEnabledForBusiness } from '../lib/push.ts'

const dismissedThisVisit = new Set<string>()
export function PushInvitation({ businessId }: { businessId: string }) {
  const [mode, setMode] = useState<'hidden' | 'ready' | 'install' | 'blocked'>('hidden')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [storageKey, setStorageKey] = useState('')
  useEffect(() => {
    let active = true
    const installed = panelDisplayMode()
    // Safari y la app instalada son dos pasos distintos del alta en iPhone.
    const key = `cale-push-invitation-v1:${businessId}:${installed ? 'app' : 'browser'}`
    setStorageKey(key)
    let dismissed = dismissedThisVisit.has(key)
    try { dismissed ||= localStorage.getItem(key) === '1' } catch { /* Respetar la decisión durante esta visita. */ }
    if (dismissed) return
    const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent)
    if (iphone && !installed) { setMode('install'); return }
    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'denied') { setMode('blocked'); return }
    pushEnabledForBusiness(businessId).then(enabled => { if (active && !enabled) setMode('ready') }).catch(() => {
      // Si no se pudo comprobar la suscripción, no insistir con un permiso nuevo.
    })
    return () => { active = false }
  }, [businessId])
  function dismiss() {
    dismissedThisVisit.add(storageKey)
    try { localStorage.setItem(storageKey, '1') } catch { /* La ayuda de Ajustes sigue disponible. */ }
    setMode('hidden')
  }
  async function activate() {
    setBusy(true); setError('')
    try { await enablePush(businessId); dismiss() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos activar las notificaciones.') }
    finally { setBusy(false) }
  }
  if (mode === 'hidden') return null
  return <Modal title="Que no se te pase un turno" onClose={dismiss}>
    <span className="grid size-12 place-items-center rounded-xl bg-tint text-link"><Bell size={26} aria-hidden="true" /></span>
    <p className="text-lg">Recibí un aviso cuando tengas una nueva reserva o se cancele un turno.</p>
    <p className="text-muted">Podés activarlos o desactivarlos después en Ajustes → Notificaciones. No mostramos datos personales de tus clientes en los avisos.</p>
    {mode === 'install' && <div className="rounded-xl bg-tint p-4">
      <p className="mb-3 font-semibold">Primero agregá Cale al inicio de tu iPhone</p>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm leading-relaxed"><li>En Safari, tocá Compartir (el cuadrado con la flecha hacia arriba). Puede estar dentro del menú de tres puntos.</li><li>Elegí “Agregar a inicio” y confirmá “Agregar”.</li><li>Abrí Cale desde su icono. Ahí podrás activar las notificaciones.</li></ol>
      {window.location.origin !== 'https://cale.com.ar' && <a className="mt-4 block break-all underline" href="https://cale.com.ar/panel">Instalá desde cale.com.ar/panel</a>}
    </div>}
    {mode === 'blocked' && <p className="rounded-xl bg-tint p-4">El permiso está bloqueado en este dispositivo. Podés cambiarlo en Ajustes del iPhone → Notificaciones → Cale, y después activar los avisos desde Ajustes de Cale.</p>}
    {error && <p role="alert" className="text-warn">{error}</p>}
    <div className="flex flex-col gap-3">
      {mode === 'ready' && <button className={PRIMARY_BUTTON} disabled={busy} onClick={() => void activate()}>{busy ? 'Activando…' : 'Activar notificaciones'}</button>}
      <button className={SECONDARY_BUTTON} disabled={busy} onClick={dismiss}>{mode === 'ready' ? 'Ahora no' : 'Entendido, continuar'}</button>
    </div>
  </Modal>
}
