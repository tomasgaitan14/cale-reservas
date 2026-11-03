import { describe, expect, it } from 'vitest'
import { normalizeWhatsapp } from '../../app/src/lib/whatsapp.ts'

describe('normalizeWhatsapp', () => {
  it.each([
    ['5493445550101', '5493445550101'],
    ['+54 9 3445-550101', '5493445550101'],
    ['(54) 9 3445 55-0101', '5493445550101'],
    ['', ''],
    ['sin número', ''],
  ])('deja solo los dígitos de "%s"', (typed, expected) => {
    expect(normalizeWhatsapp(typed)).toBe(expected)
  })
})
