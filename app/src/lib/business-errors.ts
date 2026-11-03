export interface BusinessFormErrors {
  name?: string
  slug?: string
  whatsapp?: string
  // Errores que no son de un campo en particular
  general?: string
}

export interface DatabaseError {
  code?: string
  message?: string
}

// Códigos de error de Postgres que devuelve la API
const UNIQUE_VIOLATION = '23505'
const CHECK_VIOLATION = '23514'
const INSUFFICIENT_PRIVILEGE = '42501'

// Lo que dice la función create_business cuando el slug es una página del sitio, y los nombres de las restricciones de la tabla
const RESERVED_SLUG_MESSAGE = 'slug_reserved'
const CONSTRAINT = {
  slugFormat: 'businesses_slug_format',
  nameLength: 'businesses_name_length',
  whatsappFormat: 'businesses_whatsapp_format',
} as const

const MESSAGES = {
  slugTaken: 'Ese nombre de página ya está en uso. Probá con otro.',
  slugReserved: 'Ese nombre no está disponible. Probá con otro.',
  slugFormat: 'Usá entre 3 y 40 letras, números o guiones.',
  name: 'Escribí el nombre de tu negocio (hasta 80 caracteres).',
  whatsapp: 'Escribí el número con código de país, solo dígitos (entre 10 y 15).',
  sessionExpired: 'Tu sesión venció. Salí y volvé a entrar.',
  unknown: 'No pudimos crear tu página. Probá de nuevo en un momento.',
} as const

// Traduce el rechazo de la base a un mensaje para la persona, sin mostrar detalles técnicos
export function describeCreateBusinessError({ code, message = '' }: DatabaseError): BusinessFormErrors {
  if (code === UNIQUE_VIOLATION) return { slug: MESSAGES.slugTaken }

  if (code === CHECK_VIOLATION) {
    if (message === RESERVED_SLUG_MESSAGE) return { slug: MESSAGES.slugReserved }
    if (message.includes(CONSTRAINT.slugFormat)) return { slug: MESSAGES.slugFormat }
    if (message.includes(CONSTRAINT.nameLength)) return { name: MESSAGES.name }
    if (message.includes(CONSTRAINT.whatsappFormat)) return { whatsapp: MESSAGES.whatsapp }
  }

  if (code === INSUFFICIENT_PRIVILEGE) return { general: MESSAGES.sessionExpired }
  return { general: MESSAGES.unknown }
}
