import { readBookingHostnames, readBookingOrigins } from '../_shared/environment.ts'
import { bookingHandler } from './handler.ts'
// Configuración exclusiva del servidor; no reutilizar secretos en variables VITE_.
Deno.serve(bookingHandler({
  origins: readBookingOrigins(),
  hostnames: readBookingHostnames(),
  secret: Deno.env.get('TURNSTILE_SECRET_KEY') ?? '',
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  serverKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
}))
