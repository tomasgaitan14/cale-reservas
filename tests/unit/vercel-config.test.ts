import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type Header = { key: string; value: string }
type VercelConfig = {
  rewrites: { source: string; destination: string }[]
  headers: { source: string; headers: Header[] }[]
}

const config: VercelConfig = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))

function headersFor(source: string): Header[] {
  return config.headers.find((rule) => rule.source === source)?.headers ?? []
}

function headerValue(source: string, key: string): string | undefined {
  return headersFor(source).find((header) => header.key === key)?.value
}

function contentSecurityPolicy(): Map<string, string[]> {
  const policy = headerValue('/(.*)', 'Content-Security-Policy')
  if (!policy) throw new Error('Falta la Content-Security-Policy en vercel.json')
  return new Map(
    policy.split(';').map((directive): [string, string[]] => {
      const [name = '', ...sources] = directive.trim().split(/\s+/)
      return [name, sources]
    }),
  )
}

describe('rewrites: la app es de una sola página', () => {
  const rewrite = config.rewrites[0] ?? { source: '', destination: '' }
  const matches = (path: string) => new RegExp(`^${rewrite.source}$`).test(path)

  it('sirve index.html', () => {
    expect(config.rewrites).toHaveLength(1)
    expect(rewrite.destination).toBe('/index.html')
  })

  it.each(['/', '/panel', '/estetica-alba', '/peluqueria-lucero-2'])('reescribe la ruta %s', (path) => {
    expect(matches(path)).toBe(true)
  })

  it.each(['/assets/index-3f2a1c.js', '/assets/manrope-latin.woff2', '/assets/sin-extension', '/favicon.svg', '/no-existe.png'])(
    'no reescribe el archivo %s: si falta, tiene que dar 404 y no la página',
    (path) => {
      expect(matches(path)).toBe(false)
    },
  )
})

describe('Content-Security-Policy', () => {
  const policy = contentSecurityPolicy()

  it('solo ejecuta scripts propios y Turnstile, sin inline ni eval', () => {
    expect(policy.get('script-src')).toEqual(["'self'", 'https://challenges.cloudflare.com'])
    expect(policy.get('frame-src')).toEqual(['https://challenges.cloudflare.com'])
  })

  it('no admite estilos inline en hojas ni etiquetas: solo en atributos (los de React)', () => {
    expect(policy.get('style-src')).toEqual(["'self'"])
    expect(policy.get('style-src-attr')).toEqual(["'unsafe-inline'"])
  })

  it('solo se conecta a sí mismo y a Supabase, sin comodines', () => {
    const connect = policy.get('connect-src') ?? []
    expect(connect).toContain("'self'")
    expect(connect).toContain('https://*.supabase.co')
    expect(connect).not.toContain('*')
    expect(connect.every((source) => source === "'self'" || source.startsWith('https://'))).toBe(true)
  })

  it('no se puede embeber, no admite plugins y fija base y formularios', () => {
    expect(policy.get('frame-ancestors')).toEqual(["'none'"])
    expect(policy.get('object-src')).toEqual(["'none'"])
    expect(policy.get('base-uri')).toEqual(["'self'"])
    expect(policy.get('form-action')).toEqual(["'self'"])
  })

  it('cierra todo lo demás con default-src propio', () => {
    expect(policy.get('default-src')).toEqual(["'self'"])
  })
})

describe('otras cabeceras', () => {
  it.each([
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ])('%s vale %s en todas las rutas', (key, value) => {
    expect(headerValue('/(.*)', key)).toBe(value)
  })

  it('pide HTTPS por al menos un año', () => {
    const maxAge = /max-age=(\d+)/.exec(headerValue('/(.*)', 'Strict-Transport-Security') ?? '')?.[1]
    expect(Number(maxAge)).toBeGreaterThanOrEqual(31_536_000)
  })

  it('bloquea cámara, micrófono y ubicación', () => {
    const permissions = headerValue('/(.*)', 'Permissions-Policy') ?? ''
    for (const feature of ['camera', 'microphone', 'geolocation']) expect(permissions).toContain(`${feature}=()`)
  })

  it('el panel no se indexa', () => {
    expect(headerValue('/panel', 'X-Robots-Tag')).toMatch(/noindex/)
  })

  it('los archivos con hash se cachean como inmutables', () => {
    expect(headerValue('/assets/(.*)', 'Cache-Control')).toMatch(/immutable/)
  })
})
