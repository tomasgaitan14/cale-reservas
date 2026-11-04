import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, ArrowSquareOut, DownloadSimple, QrCode } from '@phosphor-icons/react'
import { Modal } from './Modal.tsx'
import type { Business } from '../lib/business.ts'
import { bookingUrl, invitation } from '../lib/onboarding.ts'
import { SECONDARY_BUTTON } from './ui.ts'

export function ShareBooking({ business, compact = false }: { business: Business; compact?: boolean }) {
  const url = bookingUrl(business.slug)
  const message = invitation(business.name, url)
  const [showQr, setShowQr] = useState(false)
  const [qr, setQr] = useState('')
  const [qrError, setQrError] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (compact && !showQr) return
    let active = true
    setQr(''); setQrError(false)
    QRCode.toString(url, { type: 'svg', margin: 4, errorCorrectionLevel: 'M', width: 240 })
      .then(svg => { if (active) setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`) })
      .catch(() => { if (active) setQrError(true) })
    return () => { active = false }
  }, [url, compact, showQr])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice('Copiado. Ya podés compartirlo.') }
    catch { setNotice('No pudimos copiar. Seleccioná el texto y copialo desde tu navegador.') }
  }
  function download() {
    const link = document.createElement('a')
    link.href = qr; link.download = `cale-${business.slug}.svg`; link.click()
  }
  return <section className={compact ? "natural-share-card flex flex-col gap-5 rounded-2xl bg-tint p-6" : "share-booking"} aria-labelledby="share-title">
    <div className="flex min-w-0 flex-col gap-4">
      <p className="eyebrow">Tu página de reservas</p>
      <h2 id="share-title" className="text-2xl">{compact ? <>Un link.<br />Más simple para todos.</> : 'Compartí tu agenda.'}</h2>
      <p className="text-muted">Compartí tu link y dejá que tus clientes elijan su turno.</p>
      <p className={compact ? "natural-share-url" : "break-all rounded-xl border border-field-line bg-surface p-4 font-medium"}>{url}</p>
      <div className="flex flex-wrap gap-3">
        <button className={SECONDARY_BUTTON} onClick={() => void copy(url)}><Copy aria-hidden="true" />Copiar link</button>
        {compact ? <button className={SECONDARY_BUTTON} onClick={() => setShowQr(true)}><QrCode aria-hidden="true" />Ver QR</button> : <button className={SECONDARY_BUTTON} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}><ArrowSquareOut aria-hidden="true" />Abrir página</button>}
      </div>
      {!compact && <><h3 className="mt-3 text-lg">Un mensaje para tus clientes</h3>
      <p className="text-muted">{message}</p>
      <button className={`${SECONDARY_BUTTON} self-start`} onClick={() => void copy(message)}>Copiar mensaje</button></>}
      {notice && <p role="status" className="text-sm text-link">{notice}</p>}
    </div>
    {!compact && <div className="flex flex-col items-center gap-3">
      {qr ? <img src={qr} alt={`QR para reservar en ${business.name}`} width={240} height={240} className="max-w-full rounded-2xl" /> : <p role="status">{qrError ? 'No pudimos generar el QR. El link sigue disponible.' : 'Preparando tu QR…'}</p>}
      <button className={SECONDARY_BUTTON} disabled={!qr} onClick={download}><DownloadSimple aria-hidden="true" />Guardar QR</button>
      <p className="max-w-56 text-center text-sm text-muted">Podés imprimirlo y dejarlo en tu negocio.</p>
    </div>}
    {compact && <button className="natural-open-booking" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>Abrir mi página<ArrowSquareOut size={17} aria-hidden="true" /></button>}
    {compact && showQr && <Modal title="Tu QR de reservas" onClose={() => setShowQr(false)}>{qr ? <img src={qr} width={240} height={240} alt={`QR para reservar en ${business.name}`} className="mx-auto" /> : <p role="status">{qrError ? 'No pudimos generar el QR. Probá nuevamente.' : 'Preparando tu QR…'}</p>}<button className={SECONDARY_BUTTON} disabled={!qr} onClick={download}>Guardar QR</button></Modal>}
    {compact && <p className="text-sm text-muted">WhatsApp · Próximamente</p>}
  </section>
}
