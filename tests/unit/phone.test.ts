import { describe, expect, it } from 'vitest'
import { normalizePhone } from '../../app/src/lib/phone.ts'

// Casos de la app de camila-carro-estetica, con la que se comparte esta lógica
describe('normalizePhone', () => {
  it('deja un número local con código de área en el formato internacional de celular que pide WhatsApp', () => {
    expect(normalizePhone('11 2345-6789')).toBe('5491123456789')
  })

  it.each([
    '+54 9 11 2345-6789',
    '+54 11 2345 6789',
    '011 2345-6789',
    '5491123456789',
    '541123456789',
    '0054 9 11 2345 6789',
  ])('da el mismo resultado para el mismo número escrito como %s', raw => {
    expect(normalizePhone(raw)).toBe('5491123456789')
  })

  it('entiende un código de área de tres dígitos', () => {
    expect(normalizePhone('3445 55-0142')).toBe('5493445550142')
  })

  it.each([
    ['2345-6789', 'sin código de área'],
    ['15 2345 6789', 'con el 15 y sin código de área'],
    ['344 555 014', 'con un dígito de menos'],
    ['3445 55-01421', 'con un dígito de más'],
    ['11 15 2345 6789', 'con el 15 después del código de área'],
    ['', 'vacío'],
    ['sin teléfono', 'sin dígitos'],
  ])('rechaza %s (%s)', raw => {
    expect(normalizePhone(raw)).toBeNull()
  })

  it.each(['+34 612 345 678', '0034 612 345 678'])('conserva un número extranjero escrito con su código de país, como %s', raw => {
    expect(normalizePhone(raw)).toBe('34612345678')
  })

  it.each([
    ['+598 1234', 'demasiado corto'],
    ['+34 6123 4567 8901 2345', 'más largo de lo que permite E.164'],
  ])('rechaza el número extranjero %s (%s)', raw => {
    expect(normalizePhone(raw)).toBeNull()
  })
})
