import { describe, expect, it } from 'vitest'
import { brandingStyle, contrast, DEFAULT_BRANDING, readableText, validColor, validLogoPath } from '../../app/src/lib/branding.ts'
const business='11111111-1111-4111-8111-111111111111'
const file='22222222-2222-4222-8222-222222222222'
describe('personalización segura y legible',()=>{
 it.each(['red','#fff','url(x)','#123456;display:none','#12345678'])('rechaza color %s',color=>{expect(validColor(color)).toBe(false)})
 it('solo admite rutas de logo del negocio con UUID y PNG',()=>{
  expect(validLogoPath(`${business}/${file}.png`,business)).toBe(true)
  expect(validLogoPath(`${file}/${file}.png`,business)).toBe(false)
  expect(validLogoPath(`https://evil.invalid/${business}/${file}.png`)).toBe(false)
  expect(validLogoPath(`${business}/../${file}.png`)).toBe(false)
  expect(validLogoPath(`${business}/${file}.svg`)).toBe(false)
 })
 it('mantiene al menos 4.5:1 en textos de botones y fondos incluso con colores extremos',()=>{
  for(let r=0;r<=255;r+=17)for(let g=0;g<=255;g+=17)for(let b=0;b<=255;b+=17){
   const color='#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('')
   expect(contrast(color,readableText(color))).toBeGreaterThanOrEqual(4.5)
  }
 })
 it.each(['#123b28','#732b55','#f4a3bc'])('mantiene legibles texto principal, resumen y acento con %s',color=>{
  const style=brandingStyle({...DEFAULT_BRANDING,primary_color:color,secondary_color:color,accent_color:color}) as Record<string,string>
  expect(contrast(color,style['--on-ink']!)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(color,style['--summary-text']!)).toBeGreaterThanOrEqual(4.5)
  expect(contrast('#fffdf8',style['--brand-primary-text']!)).toBeGreaterThanOrEqual(4.5)
 })
 it('los colores inválidos del servidor no se inyectan como CSS',()=>{
  const style=brandingStyle({...DEFAULT_BRANDING,primary_color:'url(x)',secondary_color:'red',accent_color:';width:0'}) as Record<string,string>
  expect(style['--ink']).toBe(DEFAULT_BRANDING.primary_color)
  expect(style['--tint']).toBe(DEFAULT_BRANDING.secondary_color)
 })
})
