import { useEffect, useState } from 'react'
import { ArrowSquareOut, Export, PlusSquare } from '@phosphor-icons/react'
import { Modal } from './Modal.tsx'
import { SECONDARY_BUTTON } from './ui.ts'

const DISMISSED_KEY = 'cale-install-dismissed-v1'
export function panelDisplayMode(): boolean {
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone)
}
export function InstallPanel({ invitation = false }: { invitation?: boolean }) {
  const [installed, setInstalled] = useState(false)
  const [eligible, setEligible] = useState(!invitation)
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const check = () => setInstalled(panelDisplayMode())
    check()
    setEligible(!invitation || /iPhone|iPad|iPod/.test(navigator.userAgent))
    try { setDismissed(localStorage.getItem(DISMISSED_KEY) === '1') } catch { /* La guía funciona sin almacenamiento local. */ }
    const media = window.matchMedia?.('(display-mode: standalone)')
    media?.addEventListener('change', check)
    window.addEventListener('pageshow', check)
    return () => { media?.removeEventListener('change', check); window.removeEventListener('pageshow', check) }
  }, [invitation])
  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch { /* No insistir durante esta visita. */ }
  }
  if (installed) return invitation ? null : <p className="text-muted">Ya estás usando Cale desde la app instalada.</p>
  if (invitation && (!eligible || dismissed)) return null
  const official = window.location.origin === 'https://app.cale.com.ar'
  return <>
    <div className={invitation ? 'install-invitation' : 'install-settings'}>
      <img src="/icons/cale-192.png" alt="" width={48} height={48} className="rounded-xl" />
      <div><h3 className="text-lg">Tu agenda, a un toque.</h3><p className="mt-2 text-muted">Agregá Cale al inicio de tu iPhone y abrí tu panel como una app.</p></div>
      <div className="flex flex-wrap gap-3"><button className={SECONDARY_BUTTON} onClick={() => setOpen(true)}>Cómo instalar</button>{invitation && <button className="px-3 py-3 text-sm text-muted underline" onClick={dismiss}>Ahora no</button>}</div>
    </div>
    {open && <Modal title="Agregá Cale al inicio" onClose={() => setOpen(false)}>
      <div className="flex items-center gap-4"><img src="/icons/cale-192.png" width={56} height={56} alt="Icono de Cale" className="rounded-xl" /><div><strong>Cale</strong><p className="text-sm text-muted">Tu panel y tu agenda.</p></div></div>
      {!official ? <div className="rounded-xl bg-tint p-4"><p className="mb-3">Para instalar la versión definitiva, abrí esta dirección en Safari:</p><a className="inline-flex items-center gap-2 break-all font-semibold underline" href="https://app.cale.com.ar/panel">app.cale.com.ar/panel<ArrowSquareOut aria-hidden="true" /></a></div> : null}
      <p className="text-muted">En tu iPhone, abrí el panel en Safari. Si llegaste desde WhatsApp u otra app, usá “Abrir en Safari”.</p>
      <ol className="install-steps">
        <li><Export aria-hidden="true" /><div><strong>1. Tocá Compartir</strong><p>Buscá el cuadrado con la flecha hacia arriba. Según tu Safari, puede estar dentro del menú de tres puntos.</p></div></li>
        <li><PlusSquare aria-hidden="true" /><div><strong>2. Elegí Agregar a inicio</strong><p>Deslizá la lista de acciones hasta encontrar la opción.</p></div></li>
        <li><img src="/icons/cale-192.png" alt="" width={28} height={28} className="rounded-md" /><div><strong>3. Confirmá con Agregar</strong><p>Dejá el nombre “Cale” y activá “Abrir como app web” si aparece.</p></div></li>
      </ol>
      <p className="text-sm text-muted">Después abrí Cale desde su icono. Si te pide ingresar, usá tu misma cuenta de Google. La agenda necesita conexión a internet.</p>
    </Modal>}
  </>
}
