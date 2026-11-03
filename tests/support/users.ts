import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { localStack } from './stack.ts'

// Dominio reservado para ejemplos: nunca resuelve a un correo real
const TEST_EMAIL_DOMAIN = 'tests.cale.example'
const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } }

// Cliente sin sesión: lo que ve alguien que entra a la API sin iniciar sesión
export function anonymousClient(): SupabaseClient {
  const { apiUrl, anonKey } = localStack()
  return createClient(apiUrl, anonKey, CLIENT_OPTIONS)
}

// Cliente con la clave de servicio: solo para preparar datos de prueba, nunca para probar permisos
export function adminClient(): SupabaseClient {
  const { apiUrl, serviceRoleKey } = localStack()
  return createClient(apiUrl, serviceRoleKey, CLIENT_OPTIONS)
}

export async function currentUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw error ?? new Error('El cliente no tiene sesión iniciada')
  return data.user.id
}

// Usuario nuevo con sesión iniciada, con el mismo token y rol que tendría en producción
export async function newUserClient(): Promise<SupabaseClient> {
  const email = `usuario-${randomUUID()}@${TEST_EMAIL_DOMAIN}`
  const password = randomUUID()

  const created = await adminClient().auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw created.error

  const client = anonymousClient()
  const signedIn = await client.auth.signInWithPassword({ email, password })
  if (signedIn.error) throw signedIn.error
  return client
}
