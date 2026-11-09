import { describe, expect, it } from 'vitest'
import { authRedirectUrl } from '../../app/src/lib/auth.ts'

describe('inicio de sesión', () => {
  it('devuelve a /panel después de iniciar sesión con Google', () => {
    expect(authRedirectUrl('https://cale.com.ar')).toBe('https://cale.com.ar/panel')
    expect(authRedirectUrl('https://cale.com.ar/')).toBe('https://cale.com.ar/panel')
  })
})
