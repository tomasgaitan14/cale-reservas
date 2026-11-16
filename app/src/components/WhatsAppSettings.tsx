import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.ts'
import { SECONDARY_BUTTON } from './ui.ts'

export function WhatsAppSettings({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState('Consultando conexión…')
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    let active = true
    const labels: Record<string, string> = { pending: 'Configuración pendiente', connected: 'Conectado', disconnected: 'Desconectado', error: 'Requiere atención' }
    void supabase.from('whatsapp_connections').select('business_id, display_phone_number, connection_status, connected_at').eq('business_id', businessId).maybeSingle().then(({ data, error }) => {
      if (active) setStatus(error ? 'No pudimos consultar la conexión.' : data ? (labels[data.connection_status] ?? 'Requiere atención') + (data.display_phone_number ? ' · ' + data.display_phone_number : '') : 'WhatsApp no conectado')
    })
    return () => { active = false }
  }, [businessId])
  return <section className="settings-section">
    <h2 className="text-xl">WhatsApp del negocio</h2>
    <p className="text-muted">Recordatorios desde tu número comercial. El equipo de Cale te acompaña en la configuración.</p>
    <p role="status" className="font-semibold">{status}</p>
    <button type="button" className={SECONDARY_BUTTON} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Configurar WhatsApp</button>
    {expanded && <div className="flex flex-col gap-4">
      <p>Conservás la propiedad de tu número y cuenta comercial. La compatibilidad para seguir usando la app del teléfono se verifica con Meta durante la configuración.</p>
      <p>Los envíos se habilitan después de verificar el número, las autorizaciones y las plantillas. Meta puede cobrar por los mensajes entregados.</p>
      <a className="underline" href="mailto:cale.turnos@gmail.com?subject=Configurar%20WhatsApp%20de%20mi%20negocio">Coordinar la configuración con Cale</a>
    </div>}
  </section>
}
