export type Route = { kind: 'panel' } | { kind: 'booking'; slug: string } | { kind: 'not-found' }

const PANEL_PATHS = ['/', '/panel']
// Un tramo con el mismo formato que los slugs de la base: minúsculas, números y guiones sueltos entre palabras
const BOOKING_PATH = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)$/

// cale.com.ar/panel es el panel del negocio y cale.com.ar/<negocio> es su página de reservas
export function parseRoute(pathname: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (PANEL_PATHS.includes(path)) return { kind: 'panel' }

  const slug = BOOKING_PATH.exec(path)?.[1]
  return slug ? { kind: 'booking', slug } : { kind: 'not-found' }
}
