import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

const allowedOrigins = new Set(['https://cale.com.ar', 'https://www.cale.com.ar', 'https://app.cale.com.ar', 'https://cale-reservas.vercel.app'])

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://cale.com.ar',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function reply(request: Request, status: number, body: unknown) {
  return Response.json(body, { status, headers: { ...corsHeaders(request), 'Cache-Control': 'no-store' } })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return reply(request, 405, { error: 'method_not_allowed' })
  if (!supabaseUrl || !serviceRoleKey) return reply(request, 503, { error: 'account_deletion_unavailable' })

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return reply(request, 401, { error: 'unauthorized' })

  const { data: userData, error: userError } = await admin.auth.getUser(authorization.slice('Bearer '.length))
  if (userError || !userData.user) return reply(request, 401, { error: 'unauthorized' })

  let body: unknown
  try { body = await request.json() } catch { return reply(request, 400, { error: 'invalid_request' }) }
  if (!body || typeof body !== 'object' || Array.isArray(body) || (body as { confirmation?: unknown }).confirmation !== 'ELIMINAR') {
    return reply(request, 400, { error: 'confirmation_required' })
  }

  const userId = userData.user.id
  const { data: memberships, error: membershipsError } = await admin.from('business_members').select('business_id').eq('user_id', userId)
  if (membershipsError) return reply(request, 503, { error: 'account_data_unavailable' })
  const businessIds = (memberships ?? []).map(row => row.business_id)

  if (businessIds.length > 0) {
    const { data: allMembers, error: membersError } = await admin.from('business_members').select('business_id, user_id').in('business_id', businessIds)
    if (membersError) return reply(request, 503, { error: 'account_data_unavailable' })
    if ((allMembers ?? []).some(row => row.user_id !== userId)) return reply(request, 409, { error: 'shared_business' })

    const { data: branding, error: brandingError } = await admin.from('business_branding').select('business_id, logo_path').in('business_id', businessIds)
    if (brandingError) return reply(request, 503, { error: 'account_data_unavailable' })

    const logoPaths = new Set((branding ?? []).map(row => row.logo_path).filter((path): path is string => Boolean(path)))
    for (const businessId of businessIds) {
      const { data: objects, error: listError } = await admin.storage.from('business-logos').list(businessId, { limit: 1000 })
      if (listError) return reply(request, 503, { error: 'account_files_unavailable' })
      for (const object of objects ?? []) logoPaths.add(`${businessId}/${object.name}`)
    }
    if (logoPaths.size > 0) {
      const { error: removeError } = await admin.storage.from('business-logos').remove([...logoPaths])
      if (removeError) return reply(request, 503, { error: 'account_files_unavailable' })
    }

    const { error: businessesError } = await admin.from('businesses').delete().in('id', businessIds)
    if (businessesError) return reply(request, 503, { error: 'account_data_unavailable' })
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId)
  if (deleteUserError) return reply(request, 503, { error: 'account_deletion_incomplete' })
  return reply(request, 200, { ok: true })
})
