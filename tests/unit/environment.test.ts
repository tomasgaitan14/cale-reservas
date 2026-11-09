import { describe, expect, it } from 'vitest'
import { corsHeaders, jsonResponse, preflightResponse } from '../../supabase/functions/_shared/cors.ts'
import {
  DEFAULT_BOOKING_HOSTNAMES,
  DEFAULT_BOOKING_ORIGINS,
  EnvironmentConfigError,
  PRODUCTION_ALLOWED_ORIGINS,
  PRODUCTION_APP_URL,
  readAllowedOrigins,
  readAppUrl,
  readBookingHostnames,
  readBookingOrigins,
  subscriptionReturnUrl,
} from '../../supabase/functions/_shared/environment.ts'

const DEV_APP_URL = 'https://dev.cale.com.ar'
const DEV_ORIGINS = [DEV_APP_URL, 'http://localhost:5174']
const env = (values: Record<string, string>) => (name: string) => values[name]
const requestFrom = (origin?: string, method = 'POST') => new Request('https://funcion.invalid/', { method, headers: origin === undefined ? {} : { origin } })

describe('URL de la aplicación por entorno', () => {
  it('sin APP_URL rige la de producción', () => {
    expect(readAppUrl(env({}))).toBe(PRODUCTION_APP_URL)
  })
  it('en desarrollo usa la declarada y le quita la barra final', () => {
    expect(readAppUrl(env({ APP_URL: DEV_APP_URL }))).toBe(DEV_APP_URL)
    expect(readAppUrl(env({ APP_URL: `  ${DEV_APP_URL}//  ` }))).toBe(DEV_APP_URL)
  })
  it.each([
    ['vacía', ''],
    ['solo espacios', '   '],
    ['sin esquema', 'dev.cale.com.ar'],
    ['con una ruta', 'https://dev.cale.com.ar/panel'],
    ['con otro esquema', 'ftp://dev.cale.com.ar'],
    ['que no es una URL', 'no es una url'],
  ])('rechaza una APP_URL %s en vez de volver a producción', (_label, value) => {
    expect(() => readAppUrl(env({ APP_URL: value }))).toThrow(EnvironmentConfigError)
  })
  it('la URL de retorno de Mercado Pago sale de la del entorno', () => {
    expect(subscriptionReturnUrl(env({}))).toBe('https://cale.com.ar/panel/ajustes')
    expect(subscriptionReturnUrl(env({ APP_URL: DEV_APP_URL }))).toBe('https://dev.cale.com.ar/panel/ajustes')
  })
})

describe('orígenes permitidos por entorno', () => {
  it('sin ALLOWED_ORIGINS rigen los de producción, en una copia que no altera la constante', () => {
    const origins = readAllowedOrigins(env({}))
    expect(origins).toEqual([...PRODUCTION_ALLOWED_ORIGINS])
    origins.push('https://otro.invalid')
    expect(readAllowedOrigins(env({}))).toEqual([...PRODUCTION_ALLOWED_ORIGINS])
  })
  it('en desarrollo usa solo los declarados, sin ninguno de producción', () => {
    const origins = readAllowedOrigins(env({ ALLOWED_ORIGINS: ' https://dev.cale.com.ar , http://localhost:5174 ' }))
    expect(origins).toEqual(DEV_ORIGINS)
    for (const production of PRODUCTION_ALLOWED_ORIGINS) expect(origins).not.toContain(production)
  })
  it.each([
    ['vacía', ''],
    ['solo separadores', ' , ,'],
    ['con comodín', '*'],
    ['con barra final', 'https://dev.cale.com.ar/'],
    ['con una ruta', 'https://dev.cale.com.ar/panel'],
    ['sin esquema', 'dev.cale.com.ar'],
    ['con un valor inválido en la lista', 'https://dev.cale.com.ar,*'],
  ])('rechaza ALLOWED_ORIGINS %s', (_label, value) => {
    expect(() => readAllowedOrigins(env({ ALLOWED_ORIGINS: value }))).toThrow(EnvironmentConfigError)
  })
})

describe('reserva pública por entorno', () => {
  it('sin variables rigen los valores por defecto', () => {
    expect(readBookingOrigins(env({}))).toEqual([...DEFAULT_BOOKING_ORIGINS])
    expect(readBookingHostnames(env({}))).toEqual([...DEFAULT_BOOKING_HOSTNAMES])
  })
  it('usa las declaradas, sin los valores por defecto', () => {
    expect(readBookingOrigins(env({ BOOKING_ALLOWED_ORIGINS: 'http://localhost:5174, https://dev.cale.com.ar' }))).toEqual(['http://localhost:5174', 'https://dev.cale.com.ar'])
    expect(readBookingHostnames(env({ BOOKING_ALLOWED_HOSTNAMES: 'localhost,dev.cale.com.ar' }))).toEqual(['localhost', 'dev.cale.com.ar'])
  })
  it('una lista declarada y vacía no autoriza a nadie (no cae en los valores por defecto)', () => {
    expect(readBookingOrigins(env({ BOOKING_ALLOWED_ORIGINS: ' , ' }))).toEqual([])
    expect(readBookingHostnames(env({ BOOKING_ALLOWED_HOSTNAMES: '' }))).toEqual([])
  })
})

describe('CORS de las funciones del panel', () => {
  it('refleja un origen permitido', () => {
    expect(corsHeaders(requestFrom(DEV_APP_URL), DEV_ORIGINS)['Access-Control-Allow-Origin']).toBe(DEV_APP_URL)
    expect(corsHeaders(requestFrom('http://localhost:5174'), DEV_ORIGINS)['Access-Control-Allow-Origin']).toBe('http://localhost:5174')
  })
  it('a un origen no permitido le responde con el primero de la lista, que el navegador rechaza', () => {
    expect(corsHeaders(requestFrom('https://evil.invalid'), DEV_ORIGINS)['Access-Control-Allow-Origin']).toBe(DEV_APP_URL)
  })
  it('en desarrollo el origen de producción no se refleja', () => {
    expect(corsHeaders(requestFrom(PRODUCTION_APP_URL), DEV_ORIGINS)['Access-Control-Allow-Origin']).toBe(DEV_APP_URL)
  })
  it('sin cabecera Origin responde con el primero de la lista', () => {
    expect(corsHeaders(requestFrom(), DEV_ORIGINS)['Access-Control-Allow-Origin']).toBe(DEV_APP_URL)
  })
  it('un origen que solo se parece a uno permitido no se refleja', () => {
    for (const origin of ['https://dev.cale.com.ar.evil.invalid', 'https://dev.cale.com.ar:8443', 'http://dev.cale.com.ar']) {
      expect(corsHeaders(requestFrom(origin), DEV_ORIGINS)['Access-Control-Allow-Origin']).toBe(DEV_APP_URL)
    }
  })
  it('declara Vary: Origin, los métodos y las cabeceras permitidas', () => {
    expect(corsHeaders(requestFrom(DEV_APP_URL), DEV_ORIGINS)).toMatchObject({
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    })
  })
  it('la respuesta previa responde 200 con las cabeceras CORS del origen', async () => {
    const response = preflightResponse(requestFrom(DEV_APP_URL, 'OPTIONS'), DEV_ORIGINS)
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(DEV_APP_URL)
  })
  it('la respuesta JSON lleva el estado, el cuerpo, las cabeceras CORS y no se guarda en caché', async () => {
    const response = jsonResponse(requestFrom(DEV_APP_URL), DEV_ORIGINS, 409, { error: 'billing_exempt' })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'billing_exempt' })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(DEV_APP_URL)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
