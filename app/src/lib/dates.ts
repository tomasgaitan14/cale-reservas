// Las reservas se arman en hora de Argentina, igual que la base. Las fechas van como 'yyyy-MM-dd' y se hacen cuentas en UTC
// para que el horario de verano de ningún país corra un día.
const TIME_ZONE = 'America/Argentina/Buenos_Aires'

// Hasta cuántos días adelante se puede reservar: es el mismo límite que aplica la base
export const MAX_DAYS_AHEAD = 30

const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const
const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

const todayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

export function todayInArgentina(now: Date = new Date()): string {
  return todayFormat.format(now)
}

// Argentina está tres horas detrás de UTC todo el año (no tiene horario de verano)
const ARGENTINA_UTC_OFFSET = '-03:00'

// Instante (UTC) en que empieza ese día en Argentina: sirve para pedirle a la base los turnos de un rango de días
export function dayStartInstant(date: string): string {
  return new Date(`${date}T00:00:00${ARGENTINA_UTC_OFFSET}`).toISOString()
}

const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// Instante guardado en la base (UTC) → día y hora de Argentina
export function localParts(instant: string): { date: string; time: string } {
  const moment = new Date(instant)
  return { date: todayFormat.format(moment), time: timeFormat.format(moment) }
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

export function addDays(date: string, days: number): string {
  const moved = parseDate(date)
  moved.setUTCDate(moved.getUTCDate() + days)
  return moved.toISOString().slice(0, 10)
}

// 0 es domingo, como en la base
export function weekdayOf(date: string): number {
  return parseDate(date).getUTCDay()
}

export function dayOfMonth(date: string): number {
  return parseDate(date).getUTCDate()
}

export function weekdayName(date: string): string {
  return WEEKDAY_NAMES[weekdayOf(date)] ?? ''
}

export function monthName(date: string): string {
  return MONTH_NAMES[parseDate(date).getUTCMonth()] ?? ''
}

// "2026-11-05" → "jueves 5 de noviembre"
export function formatLongDate(date: string): string {
  return `${weekdayName(date)} ${dayOfMonth(date)} de ${monthName(date)}`
}

// Fechas que se pueden elegir: de hoy a hoy más 30 días, solo los días de la semana en que el negocio atiende
export function bookableDates(today: string, openDays: readonly number[]): string[] {
  const dates: string[] = []
  for (let offset = 0; offset <= MAX_DAYS_AHEAD; offset++) {
    const date = addDays(today, offset)
    if (openDays.includes(weekdayOf(date))) dates.push(date)
  }
  return dates
}
