// CORS de las Edge Functions del panel. Los orígenes permitidos vienen de `readAllowedOrigins` (_shared/environment.ts):
// un origen permitido se refleja tal cual y cualquier otro recibe el primero de la lista, así el navegador lo rechaza.
const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type'
const ALLOWED_METHODS = 'POST, OPTIONS'

export function corsHeaders(request: Request, allowedOrigins: readonly string[]): Record<string, string> {
  const origin = request.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0]!,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    Vary: 'Origin',
  }
}

export function preflightResponse(request: Request, allowedOrigins: readonly string[]): Response {
  return new Response('ok', { headers: corsHeaders(request, allowedOrigins) })
}

export function jsonResponse(request: Request, allowedOrigins: readonly string[], status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { ...corsHeaders(request, allowedOrigins), 'Cache-Control': 'no-store' } })
}
