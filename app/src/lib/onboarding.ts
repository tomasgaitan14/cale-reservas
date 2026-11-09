import { appOrigin } from './slug.ts'

export const SETUP_STEPS = ['Cuenta', 'Tu negocio', 'Servicios', 'Horarios', 'Listo'] as const
export const REMINDER_OPTIONS = [24, 48, 2] as const
export type ReminderHours = typeof REMINDER_OPTIONS[number]
export type SetupStep = 'services' | 'hours' | 'ready'
export function nextSetupStep(serviceCount: number, hasHours: boolean): SetupStep {
  if (serviceCount < 1) return 'services'
  if (!hasHours) return 'hours'
  return 'ready'
}
export function bookingUrl(slug: string, origin = appOrigin()): string {
  return new URL(encodeURIComponent(slug), `${origin}/`).href
}
export function invitation(name: string, url: string): string {
  return `¡Hola! Ya podés reservar tu turno en ${name}. Elegí el servicio y el horario que te quede cómodo: ${url}`
}
