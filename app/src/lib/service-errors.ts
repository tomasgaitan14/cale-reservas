import type { DatabaseError } from './business-errors.ts'

export interface ServiceFormErrors {
  name?: string
  duration?: string
  // Errores que no son de un campo en particular
  general?: string
}

// Códigos de error de Postgres que devuelve la API
const UNIQUE_VIOLATION = '23505'
const CHECK_VIOLATION = '23514'
const INSUFFICIENT_PRIVILEGE = '42501'

// Nombres de las restricciones de la tabla services
const CONSTRAINT = {
  nameLength: 'services_name_length',
  durationRange: 'services_duration_range',
} as const

const MESSAGES = {
  nameTaken: 'Ya tenés un servicio con ese nombre.',
  name: 'Escribí el nombre del servicio (hasta 80 caracteres).',
  duration: 'Elegí una duración de entre 5 minutos y 8 horas.',
  sessionExpired: 'Tu sesión venció. Salí y volvé a entrar.',
  unknown: 'No pudimos guardar el servicio. Probá de nuevo en un momento.',
} as const

// Traduce el rechazo de la base a un mensaje para la persona, sin mostrar detalles técnicos
export function describeServiceError({ code, message = '' }: DatabaseError): ServiceFormErrors {
  if (code === UNIQUE_VIOLATION) return { name: MESSAGES.nameTaken }

  if (code === CHECK_VIOLATION) {
    if (message.includes(CONSTRAINT.nameLength)) return { name: MESSAGES.name }
    if (message.includes(CONSTRAINT.durationRange)) return { duration: MESSAGES.duration }
  }

  if (code === INSUFFICIENT_PRIVILEGE) return { general: MESSAGES.sessionExpired }
  return { general: MESSAGES.unknown }
}
