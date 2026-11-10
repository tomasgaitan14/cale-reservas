import { describe, expect, it } from 'vitest'
import { calendarColorForProfessional, PROFESSIONAL_CALENDAR_COLORS } from '../../app/src/lib/agenda-colors.ts'

const team = [
  { user_id: 'owner', role: 'owner' as const },
  { user_id: 'pro-1', role: 'professional' as const },
  { user_id: 'pro-2', role: 'professional' as const },
]

describe('calendarColorForProfessional', () => {
  it('uses the business brand for the owner', () => {
    expect(calendarColorForProfessional('owner', team, { primary_color: '#28556f' })).toBe('#28556f')
  })

  it('assigns distinct colors to professionals in team order', () => {
    expect(calendarColorForProfessional('pro-1', team, { primary_color: '#28556f' })).toBe(PROFESSIONAL_CALENDAR_COLORS[0])
    expect(calendarColorForProfessional('pro-2', team, { primary_color: '#28556f' })).toBe(PROFESSIONAL_CALENDAR_COLORS[1])
  })

  it('falls back to the brand when the member cannot be resolved', () => {
    expect(calendarColorForProfessional('unknown', team, { primary_color: '#28556f' })).toBe('#28556f')
  })
})
