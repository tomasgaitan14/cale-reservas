import { describe, expect, it } from 'vitest'
import { BILLING_DAY, FULL_PRICE, daysUntilBillingDay, nextBillingDate, proratedAmount } from '../../supabase/functions/_shared/billing.ts'

describe('reglas de facturación de Pro', () => {
  it('usa el precio completo al ingresar el día 10', () => {
    const date = new Date('2026-11-10T12:00:00.000Z')
    expect(daysUntilBillingDay(date, BILLING_DAY, 'UTC')).toBe(30)
    expect(proratedAmount(date, FULL_PRICE, BILLING_DAY, 'UTC')).toBe(FULL_PRICE)
  })

  it('cobra solo los días restantes hasta el próximo día 10', () => {
    const date = new Date('2026-11-25T12:00:00.000Z')
    expect(daysUntilBillingDay(date, BILLING_DAY, 'UTC')).toBe(15)
    expect(proratedAmount(date, FULL_PRICE, BILLING_DAY, 'UTC')).toBe(7500)
  })

  it('calcula la próxima fecha fija cuando Mercado Pago no la devuelve', () => {
    expect(nextBillingDate(new Date('2026-11-09T12:00:00.000Z'), BILLING_DAY, 'UTC')).toBe('2026-11-10T12:00:00.000Z')
    expect(nextBillingDate(new Date('2026-11-10T12:00:00.000Z'), BILLING_DAY, 'UTC')).toBe('2026-12-10T12:00:00.000Z')
  })
})
