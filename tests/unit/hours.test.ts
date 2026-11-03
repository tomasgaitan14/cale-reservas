import { describe, expect, it } from 'vitest'
import {
  DAYS,
  defaultWeek,
  describeHoursError,
  emptyWeek,
  findDayProblems,
  fromRows,
  hasAnyHours,
  nextRange,
  timeOptions,
  toRanges,
  type WeekHours,
} from '../../app/src/lib/hours.ts'

const MONDAY = 1
const TUESDAY = 2
const SATURDAY = 6
const SUNDAY = 0

// Códigos de error de Postgres que devuelve la API
const CHECK_VIOLATION = '23514'
const EXCLUSION_VIOLATION = '23P01'
const INSUFFICIENT_PRIVILEGE = '42501'

function weekWith(day: number, ranges: { start: string; end: string }[]): WeekHours {
  return { ...emptyWeek(), [day]: ranges }
}

describe('la semana en pantalla', () => {
  it('empieza el lunes y termina el domingo', () => {
    expect(DAYS.map(day => day.value)).toEqual([1, 2, 3, 4, 5, 6, 0])
  })

  it('por defecto atiende de lunes a viernes de 09:00 a 18:00', () => {
    const week = defaultWeek()
    for (const day of [1, 2, 3, 4, 5]) expect(week[day]).toEqual([{ start: '09:00', end: '18:00' }])
    expect(week[SATURDAY]).toEqual([])
    expect(week[SUNDAY]).toEqual([])
  })

  it('sabe si hay algún horario cargado', () => {
    expect(hasAnyHours(emptyWeek())).toBe(false)
    expect(hasAnyHours(defaultWeek())).toBe(true)
  })
})

describe('de las filas de la base a la semana y de vuelta', () => {
  const rows = [
    { day_of_week: TUESDAY, start_time: '14:00:00', end_time: '18:00:00' },
    { day_of_week: TUESDAY, start_time: '09:00:00', end_time: '13:00:00' },
    { day_of_week: SUNDAY, start_time: '10:00:00', end_time: '24:00:00' },
  ]

  it('agrupa por día, ordena por hora de inicio y saca los segundos', () => {
    const week = fromRows(rows)
    expect(week[TUESDAY]).toEqual([
      { start: '09:00', end: '13:00' },
      { start: '14:00', end: '18:00' },
    ])
    expect(week[SUNDAY]).toEqual([{ start: '10:00', end: '24:00' }])
    expect(week[MONDAY]).toEqual([])
  })

  it('arma los tramos para guardar de lunes a domingo, con horas HH:MM', () => {
    expect(toRanges(fromRows(rows))).toEqual([
      { day_of_week: TUESDAY, start_time: '09:00', end_time: '13:00' },
      { day_of_week: TUESDAY, start_time: '14:00', end_time: '18:00' },
      { day_of_week: SUNDAY, start_time: '10:00', end_time: '24:00' },
    ])
  })
})

describe('timeOptions: las horas que se pueden elegir', () => {
  const MINUTES_IN_A_DAY_STEPS = 24 * 4

  it('para el inicio van de 00:00 a 23:45, de a 15 minutos', () => {
    const options = timeOptions('start')
    expect(options).toHaveLength(MINUTES_IN_A_DAY_STEPS)
    expect(options[0]).toBe('00:00')
    expect(options[1]).toBe('00:15')
    expect(options.at(-1)).toBe('23:45')
  })

  it('para el fin van de 00:15 a 24:00, de a 15 minutos', () => {
    const options = timeOptions('end')
    expect(options).toHaveLength(MINUTES_IN_A_DAY_STEPS)
    expect(options[0]).toBe('00:15')
    expect(options.at(-1)).toBe('24:00')
  })

  it('suma, en su lugar, una hora cargada que no cae en los 15 minutos', () => {
    const options = timeOptions('end', '23:59')
    expect(options.indexOf('23:59')).toBe(options.indexOf('24:00') - 1)
    expect(timeOptions('start', '10:20').slice(40, 43)).toEqual(['10:00', '10:15', '10:20'])
  })

  it('no repite una hora que ya está en la lista', () => {
    expect(timeOptions('start', '09:00')).toHaveLength(MINUTES_IN_A_DAY_STEPS)
  })
})

describe('nextRange: el tramo que se sugiere al agregar otro horario', () => {
  it.each([
    ['sin tramos, el horario por defecto', [], { start: '09:00', end: '18:00' }],
    ['una hora después del último, por tres horas', [{ start: '09:00', end: '13:00' }], { start: '14:00', end: '17:00' }],
    ['sin pasar de las 23:59', [{ start: '09:00', end: '20:30' }], { start: '21:30', end: '23:59' }],
    ['hasta empezar a las 22:00', [{ start: '09:00', end: '21:00' }], { start: '22:00', end: '23:59' }],
  ])('%s', (_case, ranges, expected) => {
    expect(nextRange(ranges)).toEqual(expected)
  })

  it.each([
    ['si empezaría después de las 22:00', [{ start: '09:00', end: '21:01' }]],
    ['si el último termina al final del día', [{ start: '09:00', end: '23:59' }]],
  ])('no ofrece uno %s', (_case, ranges) => {
    expect(nextRange(ranges)).toBeNull()
  })
})

describe('findDayProblems', () => {
  it('no marca nada cuando el horario es válido, ni con un descanso ni con tramos pegados', () => {
    expect(findDayProblems(defaultWeek())).toEqual({})
    expect(findDayProblems(weekWith(MONDAY, [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }]))).toEqual({})
    expect(findDayProblems(weekWith(MONDAY, [{ start: '09:00', end: '13:00' }, { start: '13:00', end: '18:00' }]))).toEqual({})
  })

  it('no marca tramos cargados en desorden si no se pisan', () => {
    expect(findDayProblems(weekWith(MONDAY, [{ start: '14:00', end: '18:00' }, { start: '09:00', end: '13:00' }]))).toEqual({})
  })

  it.each([
    ['termina cuando empieza', [{ start: '09:00', end: '09:00' }]],
    ['termina antes de empezar', [{ start: '18:00', end: '09:00' }]],
    ['se pisa con otro', [{ start: '09:00', end: '13:00' }, { start: '12:00', end: '18:00' }]],
    ['se pisa con otro aunque estén desordenados', [{ start: '12:00', end: '18:00' }, { start: '09:00', end: '13:00' }]],
  ])('marca el día cuando un tramo %s', (_case, ranges) => {
    const problems = findDayProblems(weekWith(TUESDAY, ranges))
    expect(Object.keys(problems)).toEqual([String(TUESDAY)])
    expect(problems[TUESDAY]).toBeTruthy()
  })

  it('explica distinto un tramo al revés y uno que se pisa', () => {
    const reversed = findDayProblems(weekWith(MONDAY, [{ start: '18:00', end: '09:00' }]))[MONDAY]
    const overlapping = findDayProblems(weekWith(MONDAY, [{ start: '09:00', end: '13:00' }, { start: '12:00', end: '18:00' }]))[MONDAY]
    expect(reversed).not.toBe(overlapping)
  })
})

describe('describeHoursError', () => {
  it.each([
    [EXCLUSION_VIOLATION, /pisan/],
    [CHECK_VIOLATION, /válido/],
    [INSUFFICIENT_PRIVILEGE, /sesión/],
  ])('traduce el código %s', (code, expected) => {
    expect(describeHoursError({ code, message: 'detalle técnico' })).toMatch(expected)
  })

  it('no muestra el detalle técnico de un error que no conoce', () => {
    const message = describeHoursError({ code: 'XX000', message: 'internal error at pg_catalog' })
    expect(message).not.toMatch(/pg_catalog/)
    expect(message).toBeTruthy()
  })
})
