// Las reservas se calculan en hora de Argentina, igual que la base
const TIME_ZONE = 'America/Argentina/Buenos_Aires'
const MS_PER_MINUTE = 60_000

const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// 'yyyy-MM-dd' de hoy en Argentina
export function argentinaToday(now: Date = new Date()): string {
  return dateFormat.format(now)
}

// 'HH:MM' de este momento en Argentina
export function argentinaTime(now: Date = new Date()): string {
  return timeFormat.format(now)
}

export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`)
  moved.setUTCDate(moved.getUTCDate() + days)
  return moved.toISOString().slice(0, 10)
}

// 0 es domingo, como en la base
export function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

// Primera fecha con ese día de la semana que quede al menos `minDaysAhead` días adelante
export function nextDateOnWeekday(weekday: number, minDaysAhead: number): string {
  let date = addDays(argentinaToday(), minDaysAhead)
  while (dayOfWeek(date) !== weekday) date = addDays(date, 1)
  return date
}

export function minutesSinceMidnight(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

export { MS_PER_MINUTE }
