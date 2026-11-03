import { describe, expect, it } from 'vitest'
import { addDays, bookableDates, formatLongDate, localParts, MAX_DAYS_AHEAD, todayInArgentina, weekdayOf } from '../../app/src/lib/dates.ts'

const WEEKDAYS = [1, 2, 3, 4, 5]
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

describe('todayInArgentina', () => {
  it('usa la fecha de Argentina, que está tres horas detrás de UTC', () => {
    // Las 02:00 UTC del 3 de noviembre son las 23:00 del 2 en Argentina
    expect(todayInArgentina(new Date('2026-11-03T02:00:00Z'))).toBe('2026-11-02')
    expect(todayInArgentina(new Date('2026-11-03T03:00:00Z'))).toBe('2026-11-03')
  })
})

describe('localParts', () => {
  it.each([
    ['2026-11-05T13:00:00Z', { date: '2026-11-05', time: '10:00' }],
    ['2026-11-06T02:30:00Z', { date: '2026-11-05', time: '23:30' }],
    ['2026-11-06T03:00:00Z', { date: '2026-11-06', time: '00:00' }],
    ['2026-12-31T21:15:00Z', { date: '2026-12-31', time: '18:15' }],
  ])('pasa el instante %s a día y hora de Argentina', (instant, expected) => {
    expect(localParts(instant)).toEqual(expected)
  })
})

describe('addDays', () => {
  it.each([
    ['2026-11-02', 1, '2026-11-03'],
    ['2026-11-30', 1, '2026-12-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-11-02', 30, '2026-12-02'],
    ['2026-11-02', -1, '2026-11-01'],
  ])('suma a %s %i días y da %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected)
  })
})

describe('weekdayOf', () => {
  it('cuenta el domingo como 0, igual que la base', () => {
    expect(weekdayOf('2026-11-01')).toBe(0)
    expect(weekdayOf('2026-11-02')).toBe(1)
    expect(weekdayOf('2026-11-07')).toBe(6)
  })
})

describe('formatLongDate', () => {
  it.each([
    ['2026-11-05', 'jueves 5 de noviembre'],
    ['2026-12-01', 'martes 1 de diciembre'],
    ['2027-01-03', 'domingo 3 de enero'],
  ])('escribe %s como "%s"', (date, expected) => {
    expect(formatLongDate(date)).toBe(expected)
  })
})

describe('bookableDates', () => {
  const today = '2026-11-02'

  it('el límite es de 30 días adelante, el mismo que aplica la base', () => {
    expect(MAX_DAYS_AHEAD).toBe(30)
  })

  it('ofrece desde hoy hasta 30 días adelante, en orden, solo los días que el negocio atiende', () => {
    const dates = bookableDates(today, WEEKDAYS)

    expect(dates[0]).toBe(today)
    // El 2 de noviembre de 2026 es lunes y 30 días después, el 2 de diciembre, es miércoles: los dos días se atienden
    expect(dates.at(-1)).toBe('2026-12-02')
    expect(dates).toEqual([...dates].sort())
    for (const date of dates) expect(WEEKDAYS).toContain(weekdayOf(date))
  })

  it('con todos los días abiertos ofrece 31 fechas, de hoy a hoy más 30', () => {
    const dates = bookableDates(today, EVERY_DAY)

    expect(dates).toHaveLength(31)
    expect(dates[0]).toBe('2026-11-02')
    expect(dates.at(-1)).toBe('2026-12-02')
  })

  it('no ofrece nada si el negocio no atiende ningún día', () => {
    expect(bookableDates(today, [])).toEqual([])
  })

  it('no incluye el día 31', () => {
    expect(bookableDates(today, EVERY_DAY)).not.toContain('2026-12-03')
  })
})
