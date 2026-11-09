// Guarda contra regresiones: las Edge Functions y las migraciones no pueden llevar escrito un dominio ni un proyecto de producción.
// Lo que cambia entre cale-dev y cale-api se declara como configuración (ver supabase/functions/_shared/environment.ts).
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SUPABASE_DIR = join(import.meta.dirname, '..', '..', 'supabase')
const FUNCTIONS_DIR = join(SUPABASE_DIR, 'functions')
const MIGRATIONS_DIR = join(SUPABASE_DIR, 'migrations')
// Único archivo donde se declaran los valores por defecto de producción
const ENVIRONMENT_FILE = ['functions', '_shared', 'environment.ts'].join('/')

const PRODUCTION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'el dominio cale.com.ar', pattern: /cale\.com\.ar/i },
  { label: 'el dominio cale-reservas.vercel.app', pattern: /cale-reservas\.vercel\.app/i },
  { label: 'la URL de un proyecto de Supabase', pattern: /[a-z0-9]{20}\.supabase\.(co|in)/i },
]

function filesUnder(directory: string, extension: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return filesUnder(path, extension)
    return path.endsWith(extension) ? [path] : []
  })
}

const sources = [...filesUnder(FUNCTIONS_DIR, '.ts'), ...filesUnder(MIGRATIONS_DIR, '.sql')]
  .map(path => ({ path: relative(SUPABASE_DIR, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }))

describe('configuración fija a producción', () => {
  it('encuentra archivos para controlar', () => {
    expect(sources.length).toBeGreaterThan(20)
    expect(sources.some(source => source.path === ENVIRONMENT_FILE)).toBe(true)
  })

  it.each(PRODUCTION_PATTERNS)('ninguna función ni migración lleva escrito $label', ({ pattern }) => {
    const offenders = sources.filter(source => source.path !== ENVIRONMENT_FILE && pattern.test(source.text)).map(source => source.path)
    expect(offenders).toEqual([])
  })

  it('el archivo de configuración sigue siendo el único con los valores por defecto de producción', () => {
    const environment = sources.find(source => source.path === ENVIRONMENT_FILE)!
    expect(environment.text).toContain('https://cale.com.ar')
  })
})
