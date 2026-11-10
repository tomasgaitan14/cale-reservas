import { describeCreateBusinessError, type BusinessFormErrors } from './business-errors.ts'
import { supabase } from './supabase.ts'

export interface Business {
  id: string
  slug: string
  name: string
  whatsapp: string
  created_at?: string
  plan?: 'gratis' | 'pro' | 'enterprise'
  billing_status?: 'free' | 'pending' | 'active' | 'past_due' | 'canceled'
  current_period_end?: string | null
  role?: TeamRole
}

export type TeamRole = 'owner' | 'admin' | 'professional'

export interface TeamMember {
  user_id: string
  role: TeamRole
  display_name: string | null
  email: string | null
  created_at: string
}

export interface BusinessInvitation {
  id: string
  email: string
  display_name: string
  role: Exclude<TeamRole, 'owner'>
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string
  created_at: string
}

export interface PublicBusiness {
  name: string
  slug: string
  logo_path: string | null
}

const BUSINESS_COLUMNS = 'id, slug, name, whatsapp, created_at, plan'

export class BusinessLoadError extends Error {
  constructor(detail: string) {
    super(`No se pudo leer el negocio: ${detail}`)
    this.name = 'BusinessLoadError'
  }
}

export class TeamLoadError extends Error {
  constructor(detail: string) {
    super(`No se pudo cargar el equipo: ${detail}`)
    this.name = 'TeamLoadError'
  }
}

export async function fetchPublicBusinesses(): Promise<PublicBusiness[]> {
  const { data, error } = await supabase.rpc('get_public_businesses')
  if (error) throw new BusinessLoadError(error.message)
  if (!Array.isArray(data)) return []
  return data.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const value = item as Record<string, unknown>
    if (typeof value.name !== 'string' || typeof value.slug !== 'string' || (value.logo_path !== null && typeof value.logo_path !== 'string')) return []
    return [{ name: value.name, slug: value.slug, logo_path: value.logo_path }]
  })
}

// La seguridad por filas deja ver solo los negocios de la persona que entró: en el MVP tiene uno
export async function fetchMyBusiness(): Promise<Business | null> {
  const { data, error } = await supabase.from('businesses').select(BUSINESS_COLUMNS).order('created_at').limit(1)
  if (error) throw new BusinessLoadError(error.message)
  const business = (data?.[0] as Business | undefined) ?? null
  if (!business) return null
  const { data: membership } = await supabase.from('business_members').select('role').eq('business_id', business.id).maybeSingle()
  const { data: billing } = await supabase.from('business_billing').select('billing_status, current_period_end').eq('business_id', business.id).maybeSingle()
  const billingStatus = (billing?.billing_status as Business['billing_status'] | undefined) ?? 'free'
  const currentPeriodEnd = billing?.current_period_end ?? null
  const periodEndTimestamp = currentPeriodEnd ? Date.parse(currentPeriodEnd) : NaN
  const canceledPeriodExpired = business.plan === 'pro' && billingStatus === 'canceled' && Number.isFinite(periodEndTimestamp) && periodEndTimestamp <= Date.now()
  if (canceledPeriodExpired) {
    try {
      await supabase.functions.invoke('sync-pro-subscription', { body: { businessId: business.id } })
      const { data: refreshedBusiness } = await supabase.from('businesses').select(BUSINESS_COLUMNS).eq('id', business.id).maybeSingle()
      const { data: refreshedBilling } = await supabase.from('business_billing').select('billing_status, current_period_end').eq('business_id', business.id).maybeSingle()
      if (refreshedBusiness) {
        return {
          ...(refreshedBusiness as Business),
          role: (membership?.role as TeamRole | undefined) ?? 'owner',
          billing_status: (refreshedBilling?.billing_status as Business['billing_status'] | undefined) ?? 'free',
          current_period_end: refreshedBilling?.current_period_end ?? null,
        }
      }
    } catch {
      // Si la sincronización falla, conservamos el estado conocido hasta el próximo intento.
    }
  }
  return { ...business, role: (membership?.role as TeamRole | undefined) ?? 'owner', billing_status: billingStatus, current_period_end: currentPeriodEnd }
}

export async function claimPendingInvitations(): Promise<number> {
  const { data, error } = await supabase.rpc('claim_pending_invitations')
  if (error) throw new TeamLoadError(error.message)
  return typeof data === 'number' ? data : 0
}

export async function fetchTeam(businessId: string): Promise<{ members: TeamMember[]; invitations: BusinessInvitation[] }> {
  const [members, invitations] = await Promise.all([
    supabase.from('business_members').select('user_id, role, display_name, email, created_at').eq('business_id', businessId).order('created_at'),
    supabase.from('business_invitations').select('id, email, display_name, role, status, expires_at, created_at').eq('business_id', businessId).eq('status', 'pending').order('created_at', { ascending: false }),
  ])
  if (members.error) throw new TeamLoadError(members.error.message)
  if (invitations.error) throw new TeamLoadError(invitations.error.message)
  return { members: (members.data ?? []) as TeamMember[], invitations: (invitations.data ?? []) as BusinessInvitation[] }
}

export async function inviteProfessional(input: { businessId: string; email: string; displayName: string; role: Exclude<TeamRole, 'owner'> }): Promise<{ emailSent: boolean }> {
  const { data, error } = await supabase.functions.invoke('invite-professional', { body: input })
  if (error) throw new TeamLoadError(error.message)
  const result = data as { emailSent?: unknown } | null
  return { emailSent: result?.emailSent === true }
}

export async function changeTeamRole(businessId: string, userId: string, role: Exclude<TeamRole, 'owner'>): Promise<void> {
  const { error } = await supabase.rpc('change_business_member_role', { p_business_id: businessId, p_user_id: userId, p_role: role })
  if (error) throw new TeamLoadError(error.message)
}

export async function removeTeamMember(businessId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_business_member', { p_business_id: businessId, p_user_id: userId })
  if (error) throw new TeamLoadError(error.message)
}

export async function revokeTeamInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_business_invitation', { p_invitation_id: invitationId })
  if (error) throw new TeamLoadError(error.message)
}

export interface NewBusinessInput {
  name: string
  slug: string
  whatsapp: string
  plan?: Business['plan']
}

export type CreateBusinessResult = { ok: true; business: Business } | { ok: false; errors: BusinessFormErrors }

export async function createBusiness(input: NewBusinessInput): Promise<CreateBusinessResult> {
  const { data, error } = await supabase.rpc('create_business', {
    p_name: input.name,
    p_slug: input.slug,
    p_whatsapp: input.whatsapp,
  })
  if (error) return { ok: false, errors: describeCreateBusinessError(error) }
  const business = data as Business
  return { ok: true, business: { ...business, plan: 'gratis', role: 'owner' } }
}
