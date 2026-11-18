import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.ts'
import { launchWhatsAppSignup, loadMetaSdk, SignupError, type SignupConfig } from '../lib/whatsapp-signup.ts'
import { SECONDARY_BUTTON } from './ui.ts'

const labels: Record<string, string> = { pending: 'Configuración pendiente', connected: 'Conectado', disconnected: 'Desconectado', error: 'Requiere atención' }

function readConnection(businessId: string) {
  return supabase.from('whatsapp_connections').select('display_phone_number, connection_status').eq('business_id', businessId).maybeSingle()
}

export function WhatsAppSettings({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState('Consultando conexión…')
  const [connected, setConnected] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [setup, setSetup] = useState<{ config: SignupConfig; sdk: Awaited<ReturnType<typeof loadMetaSdk>> } | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const attempt = useRef<AbortController | null>(null)

  useEffect(() => {
    let active = true
    void readConnection(businessId).then(({ data, error }) => {
      if (!active) return
      setConnected(data?.connection_status === 'connected')
      const label = data ? labels[data.connection_status] ?? 'Requiere atención' : 'WhatsApp no conectado'
      setStatus(error ? 'No pudimos consultar la conexión.' : label + (data?.display_phone_number ? ' · ' + data.display_phone_number : ''))
    })
    return () => {
      active = false
      attempt.current?.abort()
    }
  }, [businessId])

  useEffect(() => {
    if (!expanded || connected) return
    const controller = new AbortController()
    void (async () => {
      try {
        const { data, error } = await supabase.functions.invoke<{ config: SignupConfig | null }>('whatsapp-signup', {
          body: { action: 'configuration', businessId },
          signal: controller.signal,
        })
        if (controller.signal.aborted || error || !data?.config) return
        const sdk = await loadMetaSdk(data.config)
        if (!controller.signal.aborted) setSetup({ config: data.config, sdk })
      } catch {
        if (!controller.signal.aborted) setNotice('No pudimos cargar la ventana de Meta. Probá recargar la página.')
      }
    })()
    return () => { controller.abort() }
  }, [businessId, expanded, connected])

  async function connect() {
    if (!setup || attempt.current) return
    const controller = new AbortController()
    attempt.current = controller
    setBusy(true)
    setNotice('Elegí tu WhatsApp Business en la ventana de Meta y seleccioná Finalizar.')
    try {
      const result = await launchWhatsAppSignup(setup.sdk, setup.config, controller.signal)
      if (controller.signal.aborted) return
      setNotice('Verificando la conexión con Meta…')
      const { data, error } = await supabase.functions.invoke<{ displayPhoneNumber: string }>('whatsapp-signup', {
        body: { action: 'complete', businessId, ...result },
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (error || !data?.displayPhoneNumber) {
        const current = await readConnection(businessId)
        if (controller.signal.aborted) return
        if (current.data?.connection_status !== 'connected') throw new SignupError('failed')
        setStatus('Conectado' + (current.data.display_phone_number ? ' · ' + current.data.display_phone_number : ''))
      } else {
        setStatus('Conectado · ' + data.displayPhoneNumber)
      }
      setConnected(true)
      setNotice('WhatsApp conectado. Los recordatorios se habilitan por separado.')
    } catch (error) {
      if (controller.signal.aborted) return
      const reason = error instanceof SignupError ? error.reason : 'failed'
      const messages = {
        cancelled: 'Se cerró la ventana de Meta. Podés volver a intentar.',
        failed: 'No pudimos completar la conexión. Probá nuevamente o contactá a Cale.',
        not_coexistence: 'En Meta, elegí conectar tu cuenta existente de WhatsApp Business.',
        incomplete: 'Meta no terminó de confirmar la conexión. Abrí la ventana nuevamente y seleccioná Finalizar.',
      }
      setNotice(messages[reason])
    } finally {
      if (attempt.current === controller) attempt.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return <section className="settings-section">
    <h2 className="text-xl">WhatsApp del negocio</h2>
    <p className="text-muted">Recordatorios desde tu número comercial. El equipo de Cale te acompaña en la configuración.</p>
    <p role="status" className="font-semibold">{status}</p>
    <button type="button" className={SECONDARY_BUTTON} aria-expanded={expanded} disabled={busy} onClick={() => setExpanded(!expanded)}>{connected ? 'Ver configuración' : 'Configurar WhatsApp'}</button>
    {expanded && <div className="flex flex-col gap-4">
      <p>Conservás la propiedad de tu número y cuenta comercial. La compatibilidad para seguir usando la app del teléfono se verifica con Meta durante la configuración.</p>
      <p>Los envíos se habilitan después de verificar el número, las autorizaciones y las plantillas. Meta puede cobrar por los mensajes entregados.</p>
      {!connected && setup && <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => void connect()}>Conectar con Meta</button>}
      {notice && <p role="status">{notice}</p>}
      <a className="underline" href="mailto:cale.turnos@gmail.com?subject=Configurar%20WhatsApp%20de%20mi%20negocio">{setup || connected ? 'Consultar a Cale' : 'Coordinar la configuración con Cale'}</a>
    </div>}
  </section>
}
