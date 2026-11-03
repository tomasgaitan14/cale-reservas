import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// Número inventado: nunca el de una persona real
export const SAMPLE_WHATSAPP = '5493445550101'

const SLUG_SUFFIX_LENGTH = 8

// La base local conserva los datos entre corridas: un slug fijo chocaría con el de la corrida anterior
export function uniqueSlug(base: string): string {
  return `${base}-${randomUUID().slice(0, SLUG_SUFFIX_LENGTH)}`
}

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

// Slug válido de un largo exacto, para probar los límites
export function randomSlug(length: number): string {
  return Array.from({ length }, () => SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)]).join('')
}

export interface NewBusiness {
  name: string
  slug: string
  whatsapp: string
}

// Devuelve la respuesta tal cual, con su error si lo hay: para probar los rechazos
export function tryCreateBusiness(client: SupabaseClient, business: NewBusiness) {
  return client.rpc('create_business', { p_name: business.name, p_slug: business.slug, p_whatsapp: business.whatsapp })
}

// Crea un negocio como ese usuario y devuelve su id y su slug
export async function createBusiness(client: SupabaseClient, name: string, slugBase: string): Promise<{ id: string; slug: string }> {
  const slug = uniqueSlug(slugBase)
  const { data, error } = await tryCreateBusiness(client, { name, slug, whatsapp: SAMPLE_WHATSAPP })
  if (error) throw error
  return { id: (data as { id: string }).id, slug }
}
