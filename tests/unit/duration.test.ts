import { describe, expect, it } from 'vitest'
import { DEFAULT_DURATION_MINUTES, DURATION_OPTIONS_MINUTES, formatDuration } from '../../app/src/lib/duration.ts'

// Límites que acepta la base para la duración de un servicio
const MIN_DURATION = 5
const MAX_DURATION = 480

describe('formatDuration', () => {
  it.each([
    [5, '5 min'],
    [45, '45 min'],
    [60, '1 h'],
    [61, '1 h 1 min'],
    [90, '1 h 30 min'],
    [120, '2 h'],
    [480, '8 h'],
  ])('muestra %i minutos como "%s"', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected)
  })
})

describe('duraciones que se ofrecen', () => {
  it('están todas dentro de lo que acepta la base', () => {
    for (const minutes of DURATION_OPTIONS_MINUTES) {
      expect(minutes).toBeGreaterThanOrEqual(MIN_DURATION)
      expect(minutes).toBeLessThanOrEqual(MAX_DURATION)
    }
  })

  it('incluyen la duración que se sugiere por defecto', () => {
    expect(DURATION_OPTIONS_MINUTES).toContain(DEFAULT_DURATION_MINUTES)
  })
})
