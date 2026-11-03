import type { DatabaseError } from './business-errors.ts'

// Día de la semana como lo guarda la base: 0 es domingo. En pantalla la semana empieza el lunes
export const DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
] as const

const WEEKDAY_VALUES = [1, 2, 3, 4, 5]

export interface TimeRange {
  start: string // 'HH:MM'
  end: string
}

// Tramos de cada día; un día sin tramos es un día que no se atiende
export type WeekHours = Record<number, TimeRange[]>

// Fila de working_hours tal como la devuelve la base
export interface HoursRow {
  day_of_week: number
  start_time: string
  end_time: string
}

// Lo que recibe replace_working_hours
export interface HoursRangeInput {
  day_of_week: number
  start_time: string
  end_time: string
}

const MINUTES_PER_HOUR = 60
const LAST_MINUTE_OF_DAY = 23 * MINUTES_PER_HOUR + 59
// Un tramo nuevo no se ofrece si empezaría después de las 22:00
const LATEST_NEW_RANGE_START = 22 * MINUTES_PER_HOUR
const NEW_RANGE_GAP_MINUTES = 60
const NEW_RANGE_LENGTH_MINUTES = 180

export const DEFAULT_RANGE: TimeRange = { start: '09:00', end: '18:00' }

const ENDS_BEFORE_START = 'La hora de fin tiene que ser después de la de inicio.'
const RANGES_OVERLAP = 'Hay horarios de este día que se pisan.'

function toMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':')
  return Number(hours) * MINUTES_PER_HOUR + Number(minutes)
}

function toTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  const minutes = totalMinutes % MINUTES_PER_HOUR
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// La base devuelve '09:00:00': en pantalla va '09:00'
function trimSeconds(time: string): string {
  return time.slice(0, 'HH:MM'.length)
}

const TIME_STEP_MINUTES = 15
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR

// Horas que se pueden elegir, de a 15 minutos: el inicio no puede ser 24:00 ni el fin 00:00.
// Si el horario cargado tiene una hora que no cae en la grilla, se suma en su lugar para no perderla.
export function timeOptions(role: 'start' | 'end', current?: string): string[] {
  const first = role === 'start' ? 0 : TIME_STEP_MINUTES
  const last = role === 'start' ? MINUTES_PER_DAY - TIME_STEP_MINUTES : MINUTES_PER_DAY
  const options: string[] = []
  for (let minutes = first; minutes <= last; minutes += TIME_STEP_MINUTES) options.push(toTime(minutes))
  if (current && !options.includes(current)) options.push(current)
  return options.sort((a, b) => toMinutes(a) - toMinutes(b))
}

export function emptyWeek(): WeekHours {
  return Object.fromEntries(DAYS.map(day => [day.value, []]))
}

export function defaultWeek(): WeekHours {
  const week = emptyWeek()
  for (const day of WEEKDAY_VALUES) week[day] = [{ ...DEFAULT_RANGE }]
  return week
}

export function hasAnyHours(week: WeekHours): boolean {
  return Object.values(week).some(ranges => ranges.length > 0)
}

export function fromRows(rows: HoursRow[]): WeekHours {
  const week = emptyWeek()
  for (const row of rows) week[row.day_of_week]?.push({ start: trimSeconds(row.start_time), end: trimSeconds(row.end_time) })
  for (const ranges of Object.values(week)) ranges.sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  return week
}

export function toRanges(week: WeekHours): HoursRangeInput[] {
  return DAYS.flatMap(day => (week[day.value] ?? []).map(range => ({ day_of_week: day.value, start_time: range.start, end_time: range.end })))
}

// Tramo que se sugiere al tocar "Agregar otro horario": una hora después de que termina el último, o null si ya no entra
export function nextRange(ranges: TimeRange[]): TimeRange | null {
  const last = ranges.at(-1)
  if (!last) return { ...DEFAULT_RANGE }
  const start = toMinutes(last.end) + NEW_RANGE_GAP_MINUTES
  if (start > LATEST_NEW_RANGE_START) return null
  return { start: toTime(start), end: toTime(Math.min(start + NEW_RANGE_LENGTH_MINUTES, LAST_MINUTE_OF_DAY)) }
}

// Problemas de cada día antes de guardar. La base los vuelve a controlar: esto solo evita un viaje de ida y vuelta
export function findDayProblems(week: WeekHours): Record<number, string> {
  const problems: Record<number, string> = {}
  for (const [day, ranges] of Object.entries(week)) {
    if (ranges.some(range => toMinutes(range.end) <= toMinutes(range.start))) {
      problems[Number(day)] = ENDS_BEFORE_START
      continue
    }
    const ordered = [...ranges].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    const overlaps = ordered.some((range, index) => index > 0 && toMinutes(range.start) < toMinutes(ordered[index - 1]!.end))
    if (overlaps) problems[Number(day)] = RANGES_OVERLAP
  }
  return problems
}

// Códigos de error de Postgres que devuelve la API
const CHECK_VIOLATION = '23514'
const EXCLUSION_VIOLATION = '23P01'
const INSUFFICIENT_PRIVILEGE = '42501'

const SAVE_MESSAGES = {
  overlap: 'Hay horarios que se pisan. Revisá cada día.',
  invalid: 'Hay un horario que no es válido. Revisá cada día.',
  sessionExpired: 'Tu sesión venció. Salí y volvé a entrar.',
  unknown: 'No pudimos guardar tus horarios. Probá de nuevo en un momento.',
} as const

// Traduce el rechazo de la base al guardar el horario, sin mostrar detalles técnicos
export function describeHoursError({ code }: DatabaseError): string {
  if (code === EXCLUSION_VIOLATION) return SAVE_MESSAGES.overlap
  if (code === CHECK_VIOLATION) return SAVE_MESSAGES.invalid
  if (code === INSUFFICIENT_PRIVILEGE) return SAVE_MESSAGES.sessionExpired
  return SAVE_MESSAGES.unknown
}
