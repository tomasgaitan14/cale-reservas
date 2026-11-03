import type { DatabaseError } from './business-errors.ts'

export interface BookingFormErrors {
  name?: string
  phone?: string
  consent?: string
  // El horario que se eligió se ocupó: hay que volver a elegir
  slot?: string
  // Errores que no son de un campo en particular
  general?: string
}

// Códigos y mensajes que devuelve la base: los de reglas de negocio vienen de create_booking
const CHECK_VIOLATION = '23514'
const SLOT_UNAVAILABLE = 'slot_unavailable'
const CONSENT_REQUIRED = 'consent_required'
const TOO_MANY_BOOKINGS = 'too_many_bookings'
const BUSINESS_NOT_FOUND = 'business_not_found'
const CONSTRAINT = {
  nameLength: 'appointments_client_name_length',
  phoneFormat: 'appointments_client_phone_format',
} as const

// Tope de turnos próximos por celular en un negocio (el mismo de la base)
const MAX_BOOKINGS_PER_PHONE = 3

// También lo usa el formulario cuando el celular no se puede normalizar, antes de llegar a la base
export const INVALID_PHONE_MESSAGE = 'Escribí un celular válido, con el código de área. Por ejemplo, 3445 55-0142.'

const MESSAGES = {
  slot: 'Ese horario se acaba de ocupar. Elegí otro.',
  consent: 'Para reservar tenés que aceptar los recordatorios por WhatsApp.',
  name: 'Escribí tu nombre (hasta 80 caracteres).',
  phone: INVALID_PHONE_MESSAGE,
  tooMany: `Ya tenés ${MAX_BOOKINGS_PER_PHONE} turnos reservados en este negocio. Cuando pase alguno podés reservar otro.`,
  notFound: 'No encontramos este negocio.',
  unknown: 'No pudimos reservar tu turno. Probá de nuevo en un momento.',
} as const

// Traduce el rechazo de la base a un mensaje para quien reserva, sin mostrar detalles técnicos
export function describeBookingError({ code, message = '' }: DatabaseError): BookingFormErrors {
  if (message === SLOT_UNAVAILABLE) return { slot: MESSAGES.slot }
  if (message === CONSENT_REQUIRED) return { consent: MESSAGES.consent }
  if (message === TOO_MANY_BOOKINGS) return { general: MESSAGES.tooMany }
  if (message === BUSINESS_NOT_FOUND) return { general: MESSAGES.notFound }

  if (code === CHECK_VIOLATION) {
    if (message.includes(CONSTRAINT.nameLength)) return { name: MESSAGES.name }
    if (message.includes(CONSTRAINT.phoneFormat)) return { phone: MESSAGES.phone }
  }

  return { general: MESSAGES.unknown }
}
