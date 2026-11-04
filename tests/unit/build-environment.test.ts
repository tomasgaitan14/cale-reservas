import { describe, expect, it } from 'vitest'
import { validateBuildEnvironment } from '../../scripts/build-environment.ts'
const valid = { VITE_SUPABASE_URL: 'https://proyecto.supabase.co', VITE_SUPABASE_ANON_KEY: 'public-key', VITE_TURNSTILE_SITE_KEY: 'site-key', VITE_VAPID_PUBLIC_KEY: 'vapid-key' }
describe('configuración de publicación', () => {
  it('acepta una configuración completa', () => expect(() => validateBuildEnvironment(valid)).not.toThrow())
  it('rechaza el destino que rompió el ingreso antes de generar el paquete', () => {
    expect(() => validateBuildEnvironment({ ...valid, VITE_SUPABASE_URL: 'https://pendiente.invalid' })).toThrow('VITE_SUPABASE_URL')
  })
  it.each(Object.keys(valid))('rechaza %s vacía', key => {
    expect(() => validateBuildEnvironment({ ...valid, [key]: '' })).toThrow(key)
  })
  it.each(['https://demo.invalid', 'http://proyecto.supabase.co', 'esto-no-es-una-url'])('rechaza el servidor inválido %s', url => {
    expect(() => validateBuildEnvironment({ ...valid, VITE_SUPABASE_URL: url })).toThrow('VITE_SUPABASE_URL')
  })
})
