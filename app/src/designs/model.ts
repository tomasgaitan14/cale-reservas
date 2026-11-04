export const DESIGN_VARIANTS = ['natural', 'clara', 'editorial'] as const
export type DesignVariant = typeof DESIGN_VARIANTS[number]
export type DesignScreen = 'portada' | 'agenda' | 'reserva' | 'negocio' | 'avisos' | 'ajustes'
export const DESIGN_LABELS: Record<DesignVariant, string> = {
  natural: 'Cálida y natural', clara: 'Clara y funcional', editorial: 'Editorial con carácter',
}
export const DESIGN_DESCRIPTIONS: Record<DesignVariant, string> = {
  natural: 'Crema, salvia y formas suaves. Una agenda cercana y tranquila.',
  clara: 'Azul pizarra, información compacta y acciones directas. Una herramienta de trabajo.',
  editorial: 'Tinta, terracota y tipografía protagonista. Una identidad con carácter.',
}
export interface DemoAppointment { id: string; time: string; client: string; service: string; duration: number; status: 'confirmed' | 'pending' }
export const DEMO_APPOINTMENTS: readonly DemoAppointment[] = [
  { id: 'demo-1', time: '09:00', client: 'Cliente demo', service: 'Corte de pelo', duration: 60, status: 'confirmed' },
  { id: 'demo-2', time: '10:30', client: 'Cliente demo', service: 'Limpieza facial', duration: 60, status: 'pending' },
  { id: 'demo-3', time: '14:00', client: 'Cliente demo', service: 'Corte de pelo', duration: 60, status: 'confirmed' },
  { id: 'demo-4', time: '16:00', client: 'Cliente demo', service: 'Limpieza facial', duration: 60, status: 'pending' },
]
export const DEMO_SERVICES = ['Corte de pelo', 'Limpieza facial'] as const
export function designVariant(pathname: string): DesignVariant | null {
  const slug = /^\/disenos\/([^/]+)\/?$/.exec(pathname)?.[1]
  return DESIGN_VARIANTS.find(variant => variant === slug) ?? null
}
export function designScreen(search: string): DesignScreen {
  const value = new URLSearchParams(search).get('vista')
  return (['portada', 'agenda', 'reserva', 'negocio', 'avisos', 'ajustes'] as const).find(screen => screen === value) ?? 'portada'
}
export function endTime(time: string, duration: number): string {
  const [hours, minutes] = time.split(':').map(Number)
  const total = (hours ?? 0) * 60 + (minutes ?? 0) + duration
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
