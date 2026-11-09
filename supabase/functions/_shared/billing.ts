export const BILLING_DAY = 10
export const FULL_PRICE = 14999
export const PRORATION_PERIOD_DAYS = 30

const DAY_IN_MS = 24 * 60 * 60 * 1000

function calendarDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value)
  return { year: value('year'), month: value('month'), day: value('day') }
}

export function isBillingDay(date: Date, billingDay = BILLING_DAY, timeZone = 'America/Argentina/Cordoba') {
  return calendarDate(date, timeZone).day === billingDay
}

export function nextBillingDate(date: Date, billingDay = BILLING_DAY, timeZone = 'America/Argentina/Cordoba') {
  const current = calendarDate(date, timeZone)
  const monthOffset = current.day >= billingDay ? 1 : 0
  return new Date(Date.UTC(current.year, current.month - 1 + monthOffset, billingDay, 12)).toISOString()
}

export function daysUntilBillingDay(date: Date, billingDay = BILLING_DAY, timeZone = 'America/Argentina/Cordoba') {
  const current = calendarDate(date, timeZone)
  const monthOffset = current.day >= billingDay ? 1 : 0
  const target = Date.UTC(current.year, current.month - 1 + monthOffset, billingDay)
  const start = Date.UTC(current.year, current.month - 1, current.day)
  return Math.max(1, Math.round((target - start) / DAY_IN_MS))
}

export function proratedAmount(date: Date, amount: number, billingDay = BILLING_DAY, timeZone = 'America/Argentina/Cordoba') {
  const days = Math.min(PRORATION_PERIOD_DAYS, daysUntilBillingDay(date, billingDay, timeZone))
  return Math.max(1, Math.round(amount * days / PRORATION_PERIOD_DAYS))
}
