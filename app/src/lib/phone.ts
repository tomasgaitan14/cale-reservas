// Lógica compartida con camila-carro-estetica (server/domain/phone.ts).
// Formato canónico de un celular argentino: 54 + 9 + número nacional de 10 dígitos
const COUNTRY_CODE_AR = '54'
const MOBILE_PREFIX_AR = '9'
const TRUNK_PREFIX = '0'
const INTERNATIONAL_PREFIX = '00'

// Número nacional válido: código de área + abonado suman 10 dígitos, y los códigos de área
// empiezan con 2 o 3, salvo el 11. Así se rechaza el 15 del celular cargado sin código de área.
const NATIONAL_NUMBER_PATTERN_AR = /^(?:11\d{8}|[23]\d{9})$/

// Largo de un número extranjero con código de país (E.164 permite hasta 15)
const FOREIGN_MIN_DIGITS = 8
const FOREIGN_MAX_DIGITS = 15

// Devuelve el teléfono en formato internacional sin '+', o null si no es válido
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '')
  let hasCountryCode = raw.trim().startsWith('+')
  if (digits.startsWith(INTERNATIONAL_PREFIX)) {
    digits = digits.slice(INTERNATIONAL_PREFIX.length)
    hasCountryCode = true
  }

  if (hasCountryCode && !digits.startsWith(COUNTRY_CODE_AR)) {
    const validLength = digits.length >= FOREIGN_MIN_DIGITS && digits.length <= FOREIGN_MAX_DIGITS
    return validLength ? digits : null
  }

  // Un 54 adelante es el código de país y un 9 después, el de celular: ningún código de área
  // empieza con 5 ni con 9, así que no se confunden con el número nacional
  if (digits.startsWith(COUNTRY_CODE_AR)) {
    digits = digits.slice(COUNTRY_CODE_AR.length)
    if (digits.startsWith(MOBILE_PREFIX_AR)) digits = digits.slice(MOBILE_PREFIX_AR.length)
  }
  if (digits.startsWith(TRUNK_PREFIX)) digits = digits.slice(TRUNK_PREFIX.length)

  if (!NATIONAL_NUMBER_PATTERN_AR.test(digits)) return null
  return COUNTRY_CODE_AR + MOBILE_PREFIX_AR + digits
}
