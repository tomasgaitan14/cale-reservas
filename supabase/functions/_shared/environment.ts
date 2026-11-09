// Configuración por entorno de las Edge Functions: `cale-dev` (desarrollo) y `cale-api` (producción) usan el mismo código y cada
// uno declara sus valores como secretos del proyecto (ver `.env.example`). Sin variables rige la configuración de producción: así
// producción no necesita secretos nuevos y un entorno de desarrollo tiene que declarar los suyos para no heredar dominios de producción.
// Este es el único archivo de las funciones donde pueden aparecer dominios de producción (lo controla tests/unit/no-production-urls.test.ts).
export const PRODUCTION_APP_URL = 'https://cale.com.ar'
export const PRODUCTION_ALLOWED_ORIGINS = ['https://cale.com.ar', 'https://www.cale.com.ar', 'https://app.cale.com.ar', 'https://cale-reservas.vercel.app'] as const
export const DEFAULT_BOOKING_ORIGINS = ['http://127.0.0.1:5174', 'http://localhost:5174', 'https://cale-reservas.vercel.app', 'https://cale.com.ar'] as const
export const DEFAULT_BOOKING_HOSTNAMES = ['127.0.0.1', 'localhost', 'cale-reservas.vercel.app', 'cale.com.ar'] as const
// Mercado Pago agrega `?preapproval_id=...` al volver del checkout. La URL base no debe traer query,
// porque el proveedor concatena ese parámetro con `?`.
export const SUBSCRIPTION_RETURN_PATH = '/panel/ajustes'

export const ENV_APP_URL = 'APP_URL'
export const ENV_ALLOWED_ORIGINS = 'ALLOWED_ORIGINS'
export const ENV_BOOKING_ALLOWED_ORIGINS = 'BOOKING_ALLOWED_ORIGINS'
export const ENV_BOOKING_ALLOWED_HOSTNAMES = 'BOOKING_ALLOWED_HOSTNAMES'

const ALLOWED_PROTOCOLS = ['https:', 'http:']
const TRAILING_SLASHES = /\/+$/

export type EnvReader = (name: string) => string | undefined

export class EnvironmentConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvironmentConfigError'
  }
}

// Se resuelve al llamar (no al importar) y sin tipos de Deno, para que los tests de Node puedan importar este archivo e inyectar su lector.
type DenoRuntime = { env: { get(name: string): string | undefined } }
const readDenoEnv: EnvReader = name => (globalThis as { Deno?: DenoRuntime }).Deno?.env.get(name)

function splitList(value: string | undefined): string[] {
  return (value ?? '').split(',').map(item => item.trim()).filter(Boolean)
}

// Un origen es esquema + host (+ puerto), sin ruta ni barra final: es lo que el navegador manda en la cabecera Origin.
function assertOrigin(value: string, variable: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new EnvironmentConfigError(`${variable}: "${value}" no es una URL válida.`)
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol) || parsed.origin !== value) {
    throw new EnvironmentConfigError(`${variable}: "${value}" tiene que ser un origen (esquema y dominio, sin ruta ni barra final).`)
  }
  return value
}

// Una variable ausente usa la configuración de producción; una variable declarada pero vacía es un error de configuración y no cae
// en producción en silencio (un desarrollo mal configurado no debe heredar los dominios de producción).

// URL pública de la aplicación del entorno (retorno de Mercado Pago). Sin barra final.
export function readAppUrl(env: EnvReader = readDenoEnv): string {
  const raw = env(ENV_APP_URL)
  if (raw === undefined) return PRODUCTION_APP_URL
  const value = raw.trim().replace(TRAILING_SLASHES, '')
  if (!value) throw new EnvironmentConfigError(`${ENV_APP_URL} está declarada pero vacía.`)
  return assertOrigin(value, ENV_APP_URL)
}

// Orígenes que pueden llamar a las funciones del panel desde el navegador (CORS).
export function readAllowedOrigins(env: EnvReader = readDenoEnv): string[] {
  const raw = env(ENV_ALLOWED_ORIGINS)
  if (raw === undefined) return [...PRODUCTION_ALLOWED_ORIGINS]
  const origins = splitList(raw)
  if (origins.length === 0) throw new EnvironmentConfigError(`${ENV_ALLOWED_ORIGINS} está declarada pero vacía.`)
  return origins.map(origin => assertOrigin(origin, ENV_ALLOWED_ORIGINS))
}

// Las listas de la reserva pública se mantienen como estaban: una lista vacía no autoriza a nadie (la reserva responde 403 o 503).
export function readBookingOrigins(env: EnvReader = readDenoEnv): string[] {
  const raw = env(ENV_BOOKING_ALLOWED_ORIGINS)
  return raw === undefined ? [...DEFAULT_BOOKING_ORIGINS] : splitList(raw)
}

// Dominios que Cloudflare Turnstile puede informar al verificar un token de reserva.
export function readBookingHostnames(env: EnvReader = readDenoEnv): string[] {
  const raw = env(ENV_BOOKING_ALLOWED_HOSTNAMES)
  return raw === undefined ? [...DEFAULT_BOOKING_HOSTNAMES] : splitList(raw)
}

export function subscriptionReturnUrl(env: EnvReader = readDenoEnv): string {
  return `${readAppUrl(env)}${SUBSCRIPTION_RETURN_PATH}`
}
