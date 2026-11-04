// Las variables VITE_ son públicas y deben validarse antes de generar el paquete.
export function validateBuildEnvironment(env: Record<string, string | undefined>) {
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_TURNSTILE_SITE_KEY', 'VITE_VAPID_PUBLIC_KEY']
  for (const key of required) {
    const value = env[key]?.trim()
    if (!value || /pendiente|placeholder|example|changeme/i.test(value)) {
      throw new Error(`Configuración de publicación inválida: ${key}. Completá la variable antes de compilar.`)
    }
  }
  let url: URL
  try { url = new URL(env.VITE_SUPABASE_URL!) } catch { throw new Error('VITE_SUPABASE_URL debe ser una URL HTTPS válida.') }
  if (url.protocol !== 'https:' || /(^|\.)(invalid|localhost|test)$/.test(url.hostname) || url.username || url.password) {
    throw new Error('VITE_SUPABASE_URL debe apuntar al proyecto HTTPS de Supabase.')
  }
}
