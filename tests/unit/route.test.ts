import { describe, expect, it } from 'vitest'
import { parseRoute } from '../../app/src/lib/route.ts'

describe('parseRoute', () => {
  it.each(['/', '/panel', '/panel/'])('%s es el panel del negocio', pathname => {
    expect(parseRoute(pathname)).toEqual({ kind: 'panel' })
  })

  it.each([
    ['/peluqueria-lucero', 'peluqueria-lucero'],
    ['/peluqueria-lucero/', 'peluqueria-lucero'],
    ['/lucero2', 'lucero2'],
  ])('%s es la página de reservas de "%s"', (pathname, slug) => {
    expect(parseRoute(pathname)).toEqual({ kind: 'booking', slug })
  })

  it.each([
    ['/Peluqueria', 'con mayúsculas'],
    ['/peluqueria lucero', 'con espacios'],
    ['/-lucero', 'con guion al principio'],
    ['/lucero--sur', 'con dos guiones seguidos'],
    ['/lucero/otra-cosa', 'con más de un tramo'],
    ['/peluquería', 'con tilde'],
  ])('%s no es una página (%s)', pathname => {
    expect(parseRoute(pathname)).toEqual({ kind: 'not-found' })
  })
})
