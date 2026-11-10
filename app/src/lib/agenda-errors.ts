import type { DatabaseError } from './business-errors.ts'

export interface AgendaFormErrors {
  name?: string
  phone?: string
  service?: string
  // La fecha y la hora: ocupada, pasada, al revés, demasiado larga
  time?: string
  reason?: string
  // Errores que no son de un campo en particular
  general?: string
}

// Códigos y mensajes que devuelve la base: los de reglas de negocio vienen de create_time_block y create_owner_booking
const CHECK_VIOLATION = '23514'
const INSUFFICIENT_PRIVILEGE = '42501'
const OVERLAPS_APPOINTMENT = 'overlaps_appointment'
const SLOT_UNAVAILABLE = 'slot_unavailable'
const IN_THE_PAST = 'in_the_past'
const TOO_FAR = 'too_far'
const SERVICE_NOT_FOUND = 'service_not_found'
const PROFESSIONAL_ASSIGNMENT_FORBIDDEN = 'professional_assignment_forbidden'
const CONSTRAINT = {
  nameLength: 'appointments_client_name_length',
  phoneFormat: 'appointments_client_phone_format',
  blockEndAfterStart: 'time_blocks_end_after_start',
  blockMaxLength: 'time_blocks_max_length',
  blockReasonLength: 'time_blocks_reason_length',
} as const

const MESSAGES = {
  overlapsAppointment: 'En ese horario hay turnos reservados. Cancelalos primero y volvé a bloquearlo.',
  slotUnavailable: 'Ese horario ya está ocupado. Elegí otro.',
  inThePast: 'Esa fecha y hora ya pasaron.',
  tooFar: 'No se pueden cargar turnos a más de un año.',
  service: 'Elegí un servicio de tu lista.',
  serviceAssignment: 'Ese servicio está asignado a otro profesional.',
  name: 'Escribí el nombre del cliente (hasta 80 caracteres).',
  phone: 'Escribí un celular válido, con el código de área. Por ejemplo, 3445 55-0142.',
  blockOrder: 'El bloqueo tiene que terminar después de empezar.',
  blockLength: 'Un bloqueo puede durar hasta 90 días.',
  reason: 'El motivo puede tener hasta 80 caracteres.',
  sessionExpired: 'Tu sesión venció. Salí y volvé a entrar.',
  unknown: 'No pudimos guardar el cambio. Probá de nuevo en un momento.',
} as const

// Traduce el rechazo de la base a un mensaje para el negocio, sin mostrar detalles técnicos
export function describeAgendaError({ code, message = '' }: DatabaseError): AgendaFormErrors {
  if (message === OVERLAPS_APPOINTMENT) return { time: MESSAGES.overlapsAppointment }
  if (message === SLOT_UNAVAILABLE) return { time: MESSAGES.slotUnavailable }
  if (message === IN_THE_PAST) return { time: MESSAGES.inThePast }
  if (message === TOO_FAR) return { time: MESSAGES.tooFar }
  if (message === SERVICE_NOT_FOUND) return { service: MESSAGES.service }
  if (message === PROFESSIONAL_ASSIGNMENT_FORBIDDEN) return { service: MESSAGES.serviceAssignment }

  if (code === CHECK_VIOLATION) {
    if (message.includes(CONSTRAINT.nameLength)) return { name: MESSAGES.name }
    if (message.includes(CONSTRAINT.phoneFormat)) return { phone: MESSAGES.phone }
    if (message.includes(CONSTRAINT.blockEndAfterStart)) return { time: MESSAGES.blockOrder }
    if (message.includes(CONSTRAINT.blockMaxLength)) return { time: MESSAGES.blockLength }
    if (message.includes(CONSTRAINT.blockReasonLength)) return { reason: MESSAGES.reason }
  }

  if (code === INSUFFICIENT_PRIVILEGE) return { general: MESSAGES.sessionExpired }
  return { general: MESSAGES.unknown }
}
