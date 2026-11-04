import { localParts, weekdayOf, addDays } from './dates.ts'
import type { WeekHours } from './hours.ts'

// Turno y bloqueo tal como los devuelve la base. Los instantes están en UTC y se pasan a hora de Argentina con localParts
export interface AgendaAppointment {
  id: string
  client_name: string
  client_phone: string | null
  service_name: string
  status: string
  source: string
  starts_at: string
  ends_at: string
}

export interface AgendaBlock {
  id: string
  starts_at: string
  ends_at: string
  reason: string | null
}

interface ItemBase {
  id: string
  // Minutos desde la medianoche de ese día: 0 a 1440
  startMinutes: number
  endMinutes: number
}

export interface AppointmentItem extends ItemBase {
  kind: 'appointment'
  clientName: string
  status: string
  clientPhone: string | null
  serviceName: string
  source: string
}

export interface BlockItem extends ItemBase {
  kind: 'block'
  reason: string | null
}

export type AgendaItem = AppointmentItem | BlockItem

export interface MinuteRange {
  start: number
  end: number
}

const MINUTES_PER_HOUR = 60
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR
const CANCELLED = 'cancelled'
const DAYS_PER_WEEK = 7
// La semana empieza el lunes: el domingo (0) es el séptimo día
const DAYS_FROM_MONDAY_OFFSET = 6
// Franja que se muestra cuando no hay horario cargado ni turnos
export const DEFAULT_RANGE_START = 8 * MINUTES_PER_HOUR
export const DEFAULT_RANGE_END = 20 * MINUTES_PER_HOUR
// Los clics sobre la grilla se redondean a este paso
const CLICK_STEP_MINUTES = 15

// "09:30" → 570. También entiende "24:00" (1440)
export function timeToMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':')
  return Number(hours) * MINUTES_PER_HOUR + Number(minutes)
}

// 570 → "09:30"
export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  const minutes = totalMinutes % MINUTES_PER_HOUR
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// Parte de un intervalo que cae en ese día, en minutos; null si no cae o si queda vacía. Las fechas 'yyyy-MM-dd' se comparan como texto
function segmentOn(date: string, startsAt: string, endsAt: string): MinuteRange | null {
  const from = localParts(startsAt)
  const to = localParts(endsAt)
  if (date < from.date || date > to.date) return null

  const start = date === from.date ? timeToMinutes(from.time) : 0
  const end = date === to.date ? timeToMinutes(to.time) : MINUTES_PER_DAY
  return end > start ? { start, end } : null
}

// Lo que hay en la agenda ese día, de la mañana a la noche. Los turnos cancelados no se muestran
export function dayItems(date: string, appointments: AgendaAppointment[], blocks: AgendaBlock[]): AgendaItem[] {
  const items: AgendaItem[] = []

  for (const appointment of appointments) {
    if (appointment.status === CANCELLED) continue
    const segment = segmentOn(date, appointment.starts_at, appointment.ends_at)
    if (!segment) continue
    items.push({
      kind: 'appointment',
      id: appointment.id,
      startMinutes: segment.start,
      endMinutes: segment.end,
      clientName: appointment.client_name,
      status: appointment.status,
      clientPhone: appointment.client_phone,
      serviceName: appointment.service_name,
      source: appointment.source,
    })
  }

  for (const block of blocks) {
    const segment = segmentOn(date, block.starts_at, block.ends_at)
    if (segment) items.push({ kind: 'block', id: block.id, startMinutes: segment.start, endMinutes: segment.end, reason: block.reason })
  }

  return items.sort((a, b) => a.startMinutes - b.startMinutes)
}

// Franja de horas que se muestra: el horario de esos días, estirada para que entre cualquier turno cargado afuera, en horas en punto.
// Los bloqueos no la estiran: uno de todo el día no tiene que mostrar la agenda entera.
export function visibleRange(dates: string[], hours: WeekHours, items: AgendaItem[]): MinuteRange {
  const spans = dates.flatMap(date => hours[weekdayOf(date)] ?? [])
  const appointments = items.filter(item => item.kind === 'appointment')

  const starts = [...spans.map(span => timeToMinutes(span.start)), ...appointments.map(item => item.startMinutes)]
  const ends = [...spans.map(span => timeToMinutes(span.end)), ...appointments.map(item => item.endMinutes)]
  if (starts.length === 0) return { start: DEFAULT_RANGE_START, end: DEFAULT_RANGE_END }

  // Los horarios y los turnos ya vienen entre 00:00 y 24:00, así que la franja nunca se sale del día
  return {
    start: Math.floor(Math.min(...starts) / MINUTES_PER_HOUR) * MINUTES_PER_HOUR,
    end: Math.ceil(Math.max(...ends) / MINUTES_PER_HOUR) * MINUTES_PER_HOUR,
  }
}

// Los siete días de la semana de esa fecha, de lunes a domingo
export function weekDates(date: string): string[] {
  const monday = addDays(date, -((weekdayOf(date) + DAYS_FROM_MONDAY_OFFSET) % DAYS_PER_WEEK))
  return Array.from({ length: DAYS_PER_WEEK }, (_, offset) => addDays(monday, offset))
}

// Minutos de cada hora en punto del rango, para dibujar las líneas de la grilla
export function hourLines(range: MinuteRange): number[] {
  const lines: number[] = []
  for (let minutes = range.start; minutes <= range.end; minutes += MINUTES_PER_HOUR) lines.push(minutes)
  return lines
}

// Qué hora es el punto de la grilla donde se hizo clic, redondeada hacia abajo a los 15 minutos
export function minutesFromOffset(offsetPixels: number, hourHeightPixels: number, rangeStart: number): number {
  const minutes = (offsetPixels / hourHeightPixels) * MINUTES_PER_HOUR
  return rangeStart + Math.floor(minutes / CLICK_STEP_MINUTES) * CLICK_STEP_MINUTES
}
