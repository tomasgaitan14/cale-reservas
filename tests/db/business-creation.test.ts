import { describe, expect, it } from 'vitest'
import { createBusiness, randomSlug, SAMPLE_WHATSAPP, tryCreateBusiness, uniqueSlug } from '../support/businesses.ts'
import { CHECK_VIOLATION, UNIQUE_VIOLATION } from '../support/pg-errors.ts'
import { adminClient, newUserClient } from '../support/users.ts'


// Límites de las reglas de negocio
const MIN_SLUG_LENGTH = 3
const MAX_SLUG_LENGTH = 40
const MAX_NAME_LENGTH = 80
const MAX_WHATSAPP_DIGITS = 15

describe('creación de negocios', () => {
  it('rechaza un slug que ya usa otro negocio y no deja nada a medias', async () => {
    const lucia = await newUserClient()
    const mateo = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')

    const duplicate = await tryCreateBusiness(mateo, { name: 'Otra peluquería', slug: lucero.slug, whatsapp: SAMPLE_WHATSAPP })
    expect(duplicate.error?.code).toBe(UNIQUE_VIOLATION)

    const mateoList = await mateo.from('businesses').select('slug')
    expect(mateoList.data).toEqual([])
  })
})

const INVALID_SLUGS: Record<string, string> = {
  'vacío': '',
  'con mayúsculas': 'Lucero',
  'con espacios': 'mi negocio',
  'con tilde': 'peluquería',
  'con guion al principio': '-lucero',
  'con guion al final': 'lucero-',
  'con dos guiones seguidos': 'lu--cero',
  'de 2 caracteres': 'ab',
  'de 41 caracteres': 'a'.repeat(MAX_SLUG_LENGTH + 1),
}

// Las páginas del sitio (cale.com.ar/privacidad…) y las rutas de la app no pueden ser el nombre de un negocio
const RESERVED_SLUGS = ['privacidad', 'terminos', 'empezar', 'eliminar-datos', 'panel', 'api']

const INVALID_NAMES: Record<string, string> = {
  'vacío': '',
  'solo espacios': '   ',
  'de 81 caracteres': 'a'.repeat(MAX_NAME_LENGTH + 1),
}

const INVALID_WHATSAPPS: Record<string, string> = {
  'vacío': '',
  'con letras': '549344555abcd',
  'con signo +': '+5493445550101',
  'con espacios': '54 9 3445 550101',
  'de 9 dígitos': '123456789',
  'de 16 dígitos': '1'.repeat(MAX_WHATSAPP_DIGITS + 1),
}

describe('validación al crear un negocio', () => {
  it.each(Object.entries(INVALID_SLUGS))('rechaza un slug %s', async (_case, slug) => {
    const lucia = await newUserClient()
    const result = await tryCreateBusiness(lucia, { name: 'Peluquería Lucero', slug, whatsapp: SAMPLE_WHATSAPP })
    expect(result.error?.code).toBe(CHECK_VIOLATION)
  })

  it.each(RESERVED_SLUGS)('rechaza el slug reservado "%s"', async slug => {
    const lucia = await newUserClient()
    const result = await tryCreateBusiness(lucia, { name: 'Peluquería Lucero', slug, whatsapp: SAMPLE_WHATSAPP })
    expect(result.error?.code).toBe(CHECK_VIOLATION)
    expect(result.error?.message).toBe('slug_reserved')
  })

  it.each([MIN_SLUG_LENGTH, MAX_SLUG_LENGTH])('acepta un slug de %i caracteres', async length => {
    const lucia = await newUserClient()
    const slug = randomSlug(length)
    try {
      const result = await tryCreateBusiness(lucia, { name: 'Peluquería Lucero', slug, whatsapp: SAMPLE_WHATSAPP })
      expect(result.error).toBeNull()
    } finally {
      await adminClient().from('businesses').delete().eq('slug', slug)
    }
  })

  it.each(Object.entries(INVALID_NAMES))('rechaza un nombre %s', async (_case, name) => {
    const lucia = await newUserClient()
    const result = await tryCreateBusiness(lucia, { name, slug: uniqueSlug('lucero'), whatsapp: SAMPLE_WHATSAPP })
    expect(result.error?.code).toBe(CHECK_VIOLATION)
  })

  it.each(Object.entries(INVALID_WHATSAPPS))('rechaza un WhatsApp %s', async (_case, whatsapp) => {
    const lucia = await newUserClient()
    const result = await tryCreateBusiness(lucia, { name: 'Peluquería Lucero', slug: uniqueSlug('lucero'), whatsapp })
    expect(result.error?.code).toBe(CHECK_VIOLATION)
  })

  it('no deja leer la lista de slugs reservados', async () => {
    // La lista existe y tiene contenido: si no, el resultado vacío de abajo no probaría nada
    const stored = await adminClient().from('reserved_slugs').select('slug')
    expect(stored.error).toBeNull()
    expect(stored.data?.length).toBeGreaterThan(0)

    const lucia = await newUserClient()
    const listed = await lucia.from('reserved_slugs').select('slug')
    expect(listed.error).toBeNull()
    expect(listed.data).toEqual([])
  })
})
