import { describe, expect, it } from 'vitest'
import { cleanSlugInput, MAX_SLUG_LENGTH, PAGE_ADDRESS_PREFIX, slugify } from '../../app/src/lib/slug.ts'

describe('PAGE_ADDRESS_PREFIX: la dirección que se le muestra al negocio', () => {
  it('usa el dominio único de Cale', () => {
    expect(PAGE_ADDRESS_PREFIX).toBe('app.cale.com.ar/')
  })
})

describe('slugify: la dirección que se sugiere a partir del nombre', () => {
  it.each([
    ['Peluquería Lucero', 'peluqueria-lucero'],
    ['Estética del Norte!!', 'estetica-del-norte'],
    ['Ñandú & Co.', 'nandu-co'],
    ['  Lucero   Hair  ', 'lucero-hair'],
    ['Lucero_2024', 'lucero-2024'],
  ])('arma la dirección de "%s"', (name, expected) => {
    expect(slugify(name)).toBe(expected)
  })

  it('devuelve vacío si no queda ninguna letra ni número', () => {
    expect(slugify('!!! ???')).toBe('')
  })

  it('corta en el largo máximo sin dejar un guion al final', () => {
    // Con 39 letras y una palabra más, el corte en 40 cae justo sobre el guion
    const slug = slugify(`${'a'.repeat(MAX_SLUG_LENGTH - 1)} bbbbbb`)
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('cleanSlugInput: lo que se acepta mientras la persona escribe', () => {
  it.each([
    ['Lucero Hair', 'lucero-hair'],
    ['peluquería', 'peluqueria'],
    ['a--b', 'a-b'],
    ['-abc', 'abc'],
    ['ab$%c', 'abc'],
  ])('limpia "%s"', (typed, expected) => {
    expect(cleanSlugInput(typed)).toBe(expected)
  })

  it('deja el guion del final para que se pueda seguir escribiendo', () => {
    expect(cleanSlugInput('lucero-')).toBe('lucero-')
  })

  it('no pasa del largo máximo', () => {
    expect(cleanSlugInput('a'.repeat(MAX_SLUG_LENGTH + 10))).toHaveLength(MAX_SLUG_LENGTH)
  })
})
