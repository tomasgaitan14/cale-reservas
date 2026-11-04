import { useEffect, useState } from 'react'
import { pushEnabledForBusiness, disablePush, enablePush, testPush } from '../lib/push.ts'
import { panelDisplayMode } from './InstallPanel.tsx'
import { SECONDARY_BUTTON } from './ui.ts'
export function PushSettings({ businessId }: { businessId: string }) {
  const [state, setState] = useState<'loading' | 'unsupported' | 'install' | 'on' | 'off'>('loading')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) { setState('unsupported'); return }
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !panelDisplayMode()) { setState('install'); return }
    pushEnabledForBusiness(businessId).then(enabled => { if (active) setState(enabled && Notification.permission === 'granted' ? 'on' : 'off') }).catch(() => { if (active) { setState('off'); setNotice('No pudimos leer la activación del dispositivo.') } })
    return () => { active = false }
  }, [businessId])
  async function change(action: 'enable' | 'disable' | 'test') {
    setBusy(true); setNotice('')
    try {
      if (action === 'enable') { await enablePush(businessId); setState('on'); setNotice('Notificaciones activadas en este dispositivo.') }
      if (action === 'disable') { await disablePush(); setState('off'); setNotice('Notificaciones desactivadas en este dispositivo.') }
      if (action === 'test') { await testPush(); setNotice('Prueba solicitada. Puede tardar hasta un minuto; la entrega depende de la conexión y los ajustes del iPhone.') }
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'No pudimos actualizar las notificaciones.') }
    finally { setBusy(false) }
  }
  return <>
    <p className="text-muted">Recibí avisos de reservas nuevas y cancelaciones. Al tocarlos, se abre tu agenda. No mostramos datos personales de tus clientes en la pantalla bloqueada.</p>
    {state === 'loading' && <p role="status">Revisando este dispositivo…</p>}
    {state === 'unsupported' && <p>En iPhone necesitás iOS 16.4 o posterior y abrir Cale desde su icono en el inicio.</p>}
    {state === 'install' && <p>Primero agregá Cale al inicio y abrila desde su icono. Luego volvé a esta sección.</p>}
    {(state === 'on' || state === 'off') && <div className="flex flex-wrap gap-3">
      <button className={SECONDARY_BUTTON} disabled={busy} onClick={() => void change(state === 'on' ? 'disable' : 'enable')}>{busy ? 'Procesando…' : state === 'on' ? 'Desactivar en este dispositivo' : 'Activar notificaciones'}</button>
      {state === 'on' && <button className={SECONDARY_BUTTON} disabled={busy} onClick={() => void change('test')}>Enviar prueba</button>}
    </div>}
    <p className="text-sm text-muted">Podés cambiar el permiso en Ajustes del iPhone. Al cerrar sesión desde Cale se desactivan los avisos de este dispositivo.</p>
    {notice && <p role="status">{notice}</p>}
  </>
}
