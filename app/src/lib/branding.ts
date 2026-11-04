import type { CSSProperties } from 'react'
export interface Branding { primary_color: string; secondary_color: string; accent_color: string; logo_path: string | null }
export const DEFAULT_BRANDING: Branding = { primary_color: '#355f46', secondary_color: '#e3e9dc', accent_color: '#355f46', logo_path: null }
export const BRAND_PALETTES = [
  { name: 'Natural', primary_color: '#355f46', secondary_color: '#e3e9dc', accent_color: '#355f46' },
  { name: 'Terracota', primary_color: '#8a4535', secondary_color: '#f3e4dc', accent_color: '#965f25' },
  { name: 'Lavanda', primary_color: '#624b78', secondary_color: '#ede7f3', accent_color: '#6d526f' },
  { name: 'Azul', primary_color: '#28556f', secondary_color: '#e1edf3', accent_color: '#376a7b' },
] as const
export function validColor(color: string): boolean { return /^#[0-9a-f]{6}$/i.test(color) }
function luminance(hex: string) {
  const rgb=[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4)
  return rgb[0]!*0.2126+rgb[1]!*0.7152+rgb[2]!*0.0722
}
export function contrast(a: string,b: string): number { const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05) }
export function readableText(background: string): string { return contrast('#ffffff',background)>=contrast('#000000',background)?'#ffffff':'#000000' }
function accentText(color: string) {
  if(contrast(color,'#fffdf8')>=4.5)return color
  for(let weight=0.1;weight<=1;weight+=0.1){const dark='#'+[1,3,5].map(offset=>Math.round(parseInt(color.slice(offset,offset+2),16)*(1-weight)).toString(16).padStart(2,'0')).join('');if(contrast(dark,'#fffdf8')>=4.5)return dark}
  return '#15191c'
}
export function brandingStyle(value: Branding): CSSProperties {
  const primary=validColor(value.primary_color)?value.primary_color:DEFAULT_BRANDING.primary_color
  const secondary=validColor(value.secondary_color)?value.secondary_color:DEFAULT_BRANDING.secondary_color
  const accent=validColor(value.accent_color)?value.accent_color:DEFAULT_BRANDING.accent_color
  return { '--link':primary,'--ink':primary,'--on-ink':readableText(primary),'--ink-muted':readableText(primary),'--tint':secondary,'--summary-text':readableText(secondary),'--brand-accent':accent,'--brand-on-accent':readableText(accent),'--brand-accent-text':accentText(accent) } as CSSProperties
}
export function validLogoPath(path: string, businessId?: string): boolean {
  const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  return new RegExp(`^${uuid}/${uuid}\\.png$`,'i').test(path) && (!businessId || path.startsWith(businessId+'/'))
}
