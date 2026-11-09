// Largo máximo del slug: es el mismo límite que la restricción businesses_slug_format de la base, que es la que manda
export const MAX_SLUG_LENGTH = 40
export const PAGE_ADDRESS_PREFIX = 'cale.com.ar/'

const COMBINING_MARKS = /[̀-ͯ]/g

function withoutAccents(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '')
}

// Dirección sugerida a partir del nombre del negocio: "Peluquería Lucero" → "peluqueria-lucero"
export function slugify(name: string): string {
  return withoutAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '')
}

// Lo que se acepta mientras la persona escribe la dirección: deja el guion del final para poder seguir con otra palabra
export function cleanSlugInput(typed: string): string {
  return withoutAccents(typed)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, MAX_SLUG_LENGTH)
}
