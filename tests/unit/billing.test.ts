import { describe, expect, it } from 'vitest'
import { isSubscriptionReturn } from '../../app/src/lib/billing.ts'

describe('retorno del checkout de suscripciones', () => {
  it('reconoce el parámetro que agrega Mercado Pago', () => {
    expect(isSubscriptionReturn('?preapproval_id=test-subscription')).toBe(true)
  })
  it('mantiene compatibilidad con el retorno anterior', () => {
    expect(isSubscriptionReturn('?subscription=success')).toBe(true)
  })
  it('no inicia sincronización en una navegación normal al panel', () => {
    expect(isSubscriptionReturn('')).toBe(false)
    expect(isSubscriptionReturn('?tab=ajustes')).toBe(false)
  })
})
