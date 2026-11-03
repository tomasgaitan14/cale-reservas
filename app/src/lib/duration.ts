const MINUTES_PER_HOUR = 60

// Duraciones que se ofrecen al cargar un servicio. La base acepta de 5 minutos a 8 horas
export const DURATION_OPTIONS_MINUTES: readonly number[] = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240]
export const DEFAULT_DURATION_MINUTES = 60

// 45 → "45 min", 60 → "1 h", 90 → "1 h 30 min"
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR)
  const rest = minutes % MINUTES_PER_HOUR
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} h`
  return `${hours} h ${rest} min`
}
