import type { Branding } from './branding.ts'
import type { TeamMember } from './business.ts'

// Tonos suaves y separados entre sí para distinguir agendas sin competir con la marca.
export const PROFESSIONAL_CALENDAR_COLORS = [
  '#9a5f5f',
  '#5d8091',
  '#8b704d',
  '#75658f',
  '#4f806d',
  '#9a6f4f',
  '#55708f',
  '#8b5f7d',
] as const

export function calendarColorForProfessional(
  professionalId: string | null | undefined,
  team: Pick<TeamMember, 'user_id' | 'role'>[],
  branding: Pick<Branding, 'primary_color'>,
): string {
  const owner = team.find(member => member.role === 'owner')
  if (!professionalId || professionalId === owner?.user_id) return branding.primary_color

  const nonOwnerMembers = team.filter(member => member.role !== 'owner')
  const index = nonOwnerMembers.findIndex(member => member.user_id === professionalId)
  return index >= 0 ? PROFESSIONAL_CALENDAR_COLORS[index % PROFESSIONAL_CALENDAR_COLORS.length] ?? branding.primary_color : branding.primary_color
}
