import { describe, expect, it } from 'vitest'
import { isProOfferEligible } from '../../app/src/components/ProOfferBanner.tsx'

const now = Date.parse('2026-11-08T12:00:00.000Z')
const base = { id: 'business-demo', name: 'Negocio demo', slug: 'negocio-demo', whatsapp: '540000000000' }

describe('oferta de Pro por antigüedad', () => {
  it('se activa desde los 14 días solo para Gratis', () => {
    expect(isProOfferEligible({ ...base, plan: 'gratis', created_at: '2026-10-25T12:00:00.000Z' }, now)).toBe(true)
    expect(isProOfferEligible({ ...base, plan: 'gratis', created_at: '2026-10-26T12:00:00.000Z' }, now)).toBe(false)
    expect(isProOfferEligible({ ...base, plan: 'pro', created_at: '2026-10-01T12:00:00.000Z' }, now)).toBe(false)
  })
})
