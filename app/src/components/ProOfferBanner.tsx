import { useState } from 'react'
import { ArrowRight, Check, Copy, Crown } from '@phosphor-icons/react'
import type { Business } from '../lib/business.ts'
import { startProSubscription } from '../lib/billing.ts'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './ui.ts'

export const PRO_PROMO_CODE = 'DESCUENTOCALE50'
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000

export function isProOfferEligible(business: Business, now = Date.now()): boolean {
  if (business.plan !== 'gratis' || !business.created_at) return false
  const createdAt = new Date(business.created_at).getTime()
  return Number.isFinite(createdAt) && now - createdAt >= TWO_WEEKS_MS
}

export function ProOfferBanner({ business }: { business: Business }) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  if (!isProOfferEligible(business)) return null

  async function copyCode() {
    try { await navigator.clipboard.writeText(PRO_PROMO_CODE); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    catch { setError('No pudimos copiar el cupón. Podés seleccionarlo manualmente.') }
  }
  async function useOffer() {
    setBusy(true); setError('')
    try { window.location.assign(await startProSubscription(business.id, PRO_PROMO_CODE)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos iniciar la suscripción. Probá nuevamente.'); setBusy(false) }
  }

  return <aside className="natural-pro-offer" aria-labelledby="pro-offer-title">
    <div className="natural-pro-offer-copy"><p className="eyebrow"><Crown size={16} weight="bold" aria-hidden="true" /> Invitación especial</p><h2 id="pro-offer-title">Fuiste seleccionado: 50% OFF en tu primer mes de Pro.</h2><p>Imaginá contar con recordatorios automáticos para notificar tus próximos turnos y ayudar a que tus clientes no se olviden.</p></div>
    <div className="natural-pro-offer-action"><div className="natural-pro-coupon"><span>Cupón</span><code>{PRO_PROMO_CODE}</code><button type="button" className={SECONDARY_BUTTON} onClick={() => void copyCode()}>{copied ? <><Check size={17} aria-hidden="true" />Copiado</> : <><Copy size={17} aria-hidden="true" />Copiar</>}</button></div>{error && <p role="alert" className="text-warn">{error}</p>}<button type="button" className={`${PRIMARY_BUTTON} natural-pro-offer-button`} disabled={busy} onClick={() => void useOffer()}>{busy ? 'Preparando pago…' : 'Usar cupón y pasar a Pro'}{!busy && <ArrowRight size={18} aria-hidden="true" />}</button></div>
  </aside>
}
