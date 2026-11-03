import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RANGE_END,
  DEFAULT_RANGE_START,
  dayItems,
  hourLines,
  minutesFromOffset,
  minutesToTime,
  timeToMinutes,
  visibleRange,
  weekDates,
  type AgendaAppointment,
  type AgendaBlock,
} from '../../app/src/lib/agenda.ts'
import { emptyWeek, type WeekHours } from '../../app/src/lib/hours.ts'

const MONDAY = 1
const MIDNIGHT_END = 1440

// Argentina está tres horas detrás de UTC: 13:00Z son las 10:00 locales
function appointment(id: string, startsAt: string, endsAt: string, overrides: Partial<AgendaAppointment> = {}): AgendaAppointment {
  return {
    id,
    client_name: 'Marina Ledesma',
    client_phone: '5493445550142',
    service_name: 'Corte de pelo',
    status: 'pending',
    source: 'web',
    starts_at: startsAt,
    ends_at: endsAt,
    ...overrides,
  }
}

function block(id: string, startsAt: string, endsAt: string, reason: string | null = null): AgendaBlock {
  return { id, starts_at: startsAt, ends_at: endsAt, reason }
}

function weekWith(day: number, ranges: { start: string; end: string }[]): WeekHours {
  return { ...emptyWeek(), [day]: ranges }
}

describe('dayItems', () => {
  const lunchtime = appointment('a', '2026-11-04T13:00:00Z', '2026-11-04T14:00:00Z')

  it('pasa un turno a minutos del día en hora de Argentina', () => {
    expect(dayItems('2026-11-04', [lunchtime], [])).toEqual([
      expect.objectContaining({ kind: 'appointment', id: 'a', startMinutes: 600, endMinutes: 660 }),
    ])
  })

  it('deja afuera los turnos de otros días y los cancelados', () => {
    const otherDay = appointment('b', '2026-11-05T13:00:00Z', '2026-11-05T14:00:00Z')
    const cancelled = appointment('c', '2026-11-04T15:00:00Z', '2026-11-04T16:00:00Z', { status: 'cancelled' })

    expect(dayItems('2026-11-04', [lunchtime, otherDay, cancelled], []).map(item => item.id)).toEqual(['a'])
  })

  it('ordena por hora de inicio, sin importar cómo llegaron', () => {
    const early = appointment('early', '2026-11-04T12:00:00Z', '2026-11-04T13:00:00Z')

    expect(dayItems('2026-11-04', [lunchtime, early], []).map(item => item.id)).toEqual(['early', 'a'])
  })

  it('un turno que cruza la medianoche se corta en cada día', () => {
    const late = appointment('late', '2026-11-05T02:30:00Z', '2026-11-05T03:30:00Z') // 23:30 a 00:30

    expect(dayItems('2026-11-04', [late], [])).toEqual([expect.objectContaining({ startMinutes: 1410, endMinutes: MIDNIGHT_END })])
    expect(dayItems('2026-11-05', [late], [])).toEqual([expect.objectContaining({ startMinutes: 0, endMinutes: 30 })])
  })

  it('un bloqueo de varios días ocupa desde su hora de inicio, todo el día en el medio, y hasta su hora de fin', () => {
    const vacation = block('v', '2026-11-04T13:00:00Z', '2026-11-06T15:00:00Z', 'Vacaciones') // 4/11 10:00 a 6/11 12:00

    expect(dayItems('2026-11-04', [], [vacation])).toEqual([
      expect.objectContaining({ kind: 'block', startMinutes: 600, endMinutes: MIDNIGHT_END, reason: 'Vacaciones' }),
    ])
    expect(dayItems('2026-11-05', [], [vacation])).toEqual([expect.objectContaining({ startMinutes: 0, endMinutes: MIDNIGHT_END })])
    expect(dayItems('2026-11-06', [], [vacation])).toEqual([expect.objectContaining({ startMinutes: 0, endMinutes: 720 })])
    expect(dayItems('2026-11-07', [], [vacation])).toEqual([])
  })

  it('un bloqueo que termina justo a la medianoche no aparece en el día siguiente', () => {
    const untilMidnight = block('m', '2026-11-04T13:00:00Z', '2026-11-05T03:00:00Z')

    expect(dayItems('2026-11-05', [], [untilMidnight])).toEqual([])
  })

  it('mezcla turnos y bloqueos en un mismo día, ordenados', () => {
    const morningBlock = block('blk', '2026-11-04T11:00:00Z', '2026-11-04T12:00:00Z') // 08:00 a 09:00

    expect(dayItems('2026-11-04', [lunchtime], [morningBlock]).map(item => item.kind)).toEqual(['block', 'appointment'])
  })

  it('conserva los datos que se muestran del turno', () => {
    const [item] = dayItems('2026-11-04', [appointment('a', '2026-11-04T13:00:00Z', '2026-11-04T14:00:00Z', { source: 'manual', client_phone: null })], [])

    expect(item).toMatchObject({ clientName: 'Marina Ledesma', clientPhone: null, serviceName: 'Corte de pelo', source: 'manual' })
  })
})

describe('visibleRange', () => {
  it('sin horario ni turnos muestra la franja por defecto, de las 08:00 a las 20:00', () => {
    expect(visibleRange(['2026-11-04'], emptyWeek(), [])).toEqual({ start: 480, end: 1200 })
    expect(DEFAULT_RANGE_START).toBe(480)
    expect(DEFAULT_RANGE_END).toBe(1200)
  })

  it('con horario muestra de la hora en punto anterior a la que abre a la siguiente a la que cierra', () => {
    const week = weekWith(MONDAY, [{ start: '09:30', end: '17:15' }])

    expect(visibleRange(['2026-11-02'], week, [])).toEqual({ start: 540, end: 1080 })
  })

  it('con un descanso muestra de la primera apertura a la última hora de cierre', () => {
    const week = weekWith(MONDAY, [
      { start: '09:00', end: '13:00' },
      { start: '14:00', end: '18:00' },
    ])

    expect(visibleRange(['2026-11-02'], week, [])).toEqual({ start: 540, end: 1080 })
  })

  it('se estira para que entre un turno cargado fuera del horario', () => {
    const week = weekWith(MONDAY, [{ start: '09:00', end: '18:00' }])
    const late = dayItems('2026-11-02', [appointment('late', '2026-11-02T20:30:00Z', '2026-11-02T21:30:00Z')], []) // 17:30 a 18:30
    const early = dayItems('2026-11-02', [appointment('early', '2026-11-02T10:15:00Z', '2026-11-02T11:00:00Z')], []) // 07:15 a 08:00

    expect(visibleRange(['2026-11-02'], week, late)).toEqual({ start: 540, end: 1140 })
    expect(visibleRange(['2026-11-02'], week, early)).toEqual({ start: 420, end: 1080 })
  })

  it('un bloqueo, aunque sea de todo el día, no estira la franja', () => {
    const week = weekWith(MONDAY, [{ start: '09:00', end: '18:00' }])
    const wholeDay = dayItems('2026-11-02', [], [block('v', '2026-11-02T03:00:00Z', '2026-11-03T03:00:00Z')])

    expect(visibleRange(['2026-11-02'], week, wholeDay)).toEqual({ start: 540, end: 1080 })
  })

  it('no pasa de las 24:00 aunque el horario cierre a esa hora', () => {
    const week = weekWith(MONDAY, [{ start: '00:00', end: '24:00' }])

    expect(visibleRange(['2026-11-02'], week, [])).toEqual({ start: 0, end: MIDNIGHT_END })
  })

  it('en una semana toma los días que atienden y se queda con el rango más ancho', () => {
    const week: WeekHours = { ...emptyWeek(), 1: [{ start: '10:00', end: '14:00' }], 3: [{ start: '08:00', end: '19:00' }] }

    expect(visibleRange(weekDates('2026-11-04'), week, [])).toEqual({ start: 480, end: 1140 })
  })
})

describe('weekDates', () => {
  it.each([
    ['2026-11-04', 'un miércoles'],
    ['2026-11-02', 'un lunes'],
    ['2026-11-08', 'un domingo'],
  ])('la semana de %s (%s) va del lunes 2 al domingo 8 de noviembre', date => {
    expect(weekDates(date)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ])
  })

  it('cruza el fin de mes', () => {
    expect(weekDates('2026-12-01')[0]).toBe('2026-11-30')
    expect(weekDates('2026-12-01')[6]).toBe('2026-12-06')
  })
})

describe('horas y minutos', () => {
  it.each([
    ['00:00', 0],
    ['09:30', 570],
    ['23:59', 1439],
    ['24:00', 1440],
  ])('pasa %s a %i minutos y de vuelta', (time, minutes) => {
    expect(timeToMinutes(time)).toBe(minutes)
    expect(minutesToTime(minutes)).toBe(time)
  })

  it('las líneas de hora van de la hora en que empieza el rango a la en que termina', () => {
    expect(hourLines({ start: 540, end: 780 })).toEqual([540, 600, 660, 720, 780])
  })
})

describe('minutesFromOffset', () => {
  const hourHeight = 64

  it('el principio de la grilla es la hora en que empieza el rango', () => {
    expect(minutesFromOffset(0, hourHeight, 540)).toBe(540)
  })

  it('pasa los píxeles a minutos y los redondea hacia abajo a los 15 minutos', () => {
    // 100 px son 93,75 minutos desde las 09:00: cae en las 10:30
    expect(minutesFromOffset(100, hourHeight, 540)).toBe(630)
    expect(minutesFromOffset(hourHeight, hourHeight, 540)).toBe(600)
    expect(minutesFromOffset(hourHeight - 1, hourHeight, 540)).toBe(585)
  })
})
