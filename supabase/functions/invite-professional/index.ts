import { createClient } from 'npm:@supabase/supabase-js@2'
import { jsonResponse, preflightResponse } from '../_shared/cors.ts'
import { readAllowedOrigins, readAppUrl } from '../_shared/environment.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const allowedOrigins = readAllowedOrigins()
const INVITATION_DAYS = 7
const FREE_TEAM_LIMIT = 3

type RequestBody = {
  businessId?: unknown
  email?: unknown
  displayName?: unknown
  role?: unknown
}

function normalizedEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null
}

Deno.serve(async request => {
  const reply = (status: number, body: unknown) => jsonResponse(request, allowedOrigins, status, body)
  if (request.method === 'OPTIONS') return preflightResponse(request, allowedOrigins)
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
  if (!supabaseUrl || !serviceRoleKey) return reply(503, { error: 'invitation_unavailable' })

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'unauthorized' })
  const { data: userData, error: userError } = await admin.auth.getUser(authorization.slice('Bearer '.length))
  if (userError || !userData.user) return reply(401, { error: 'unauthorized' })

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return reply(400, { error: 'invalid_request' })
  }

  if (typeof body.businessId !== 'string') return reply(400, { error: 'invalid_request' })
  const email = normalizedEmail(body.email)
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const role = body.role === 'admin' || body.role === 'professional' ? body.role : null
  if (!email || displayName.length < 1 || displayName.length > 80 || !role) return reply(400, { error: 'invalid_request' })

  const { data: membership, error: membershipError } = await admin
    .from('business_members')
    .select('role')
    .eq('business_id', body.businessId)
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (membershipError || !membership || (membership.role !== 'owner' && membership.role !== 'admin')) return reply(403, { error: 'forbidden' })

  if (membership.role === 'admin' && role === 'admin') return reply(403, { error: 'admin_can_only_invite_professionals' })

  const { data: business, error: businessError } = await admin
    .from('businesses')
    .select('plan')
    .eq('id', body.businessId)
    .maybeSingle()
  if (businessError || !business) return reply(404, { error: 'business_not_found' })

  const { data: existingInvitation, error: existingInvitationError } = await admin
    .from('business_invitations')
    .select('id')
    .eq('business_id', body.businessId)
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle()
  if (existingInvitationError) return reply(503, { error: 'invitation_check_failed' })

  if (business.plan !== 'pro') {
    const [members, invitations] = await Promise.all([
      admin.from('business_members').select('user_id', { count: 'exact', head: true }).eq('business_id', body.businessId).in('role', ['admin', 'professional']),
      admin.from('business_invitations').select('id', { count: 'exact', head: true }).eq('business_id', body.businessId).eq('status', 'pending').in('role', ['admin', 'professional']),
    ])
    if (members.error || invitations.error) return reply(503, { error: 'team_limit_check_failed' })
    const occupiedSeats = (members.count ?? 0) + (invitations.count ?? 0) - (existingInvitation ? 1 : 0)
    if (occupiedSeats >= FREE_TEAM_LIMIT) return reply(409, { error: 'professional_limit_reached', limit: FREE_TEAM_LIMIT })
  }

  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 86_400_000).toISOString()

  const invitation = existingInvitation
    ? await admin.from('business_invitations').update({ display_name: displayName, role, invited_by: userData.user.id, expires_at: expiresAt }).eq('id', existingInvitation.id)
    : await admin.from('business_invitations').insert({ business_id: body.businessId, email, display_name: displayName, role, invited_by: userData.user.id, expires_at: expiresAt })
  if (invitation.error) return reply(503, { error: 'invitation_save_failed' })

  let emailSent = false
  try {
    const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${readAppUrl()}/panel` })
    emailSent = !invited.error
  } catch {
    // La invitación queda guardada: si la persona ya tiene cuenta, se asociará al entrar con Google.
  }

  return reply(200, { invited: true, emailSent })
})
