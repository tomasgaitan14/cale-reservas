import { bookingHandler } from './handler.ts'
// Configuración exclusiva del servidor; no reutilizar secretos en variables VITE_.
Deno.serve(bookingHandler({
  origins: (Deno.env.get('BOOKING_ALLOWED_ORIGINS') ?? 'http://127.0.0.1:5174,http://localhost:5174,https://cale-reservas.vercel.app,https://cale.com.ar').split(',').map(value => value.trim()).filter(Boolean),
  hostnames: (Deno.env.get('BOOKING_ALLOWED_HOSTNAMES') ?? '127.0.0.1,localhost,cale-reservas.vercel.app,cale.com.ar').split(',').map(value => value.trim()).filter(Boolean),
  secret: Deno.env.get('TURNSTILE_SECRET_KEY') ?? '',
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  serverKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
}))
