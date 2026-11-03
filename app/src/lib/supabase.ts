import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY: copiá .env.example a .env.local y completalas')
}

// La clave anon es pública por diseño: lo que protege los datos es la seguridad por filas de la base
export const supabase = createClient(url, anonKey)
