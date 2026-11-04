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
 it('mantiene al menos 3:1 al priorizar blanco en fondos intermedios',()=>{
  for(let r=0;r<=255;r+=17)for(let g=0;g<=255;g+=17)for(let b=0;b<=255;b+=17){
   const color='#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('')
   expect(contrast(color,readableText(color))).toBeGreaterThanOrEqual(3)
  }
 })
 it.each(['#123b28','#732b55','#f4a3bc'])('mantiene legibles texto principal, resumen y acento con %s',color=>{
  const style=brandingStyle({...DEFAULT_BRANDING,primary_color:color,secondary_color:color,accent_color:color}) as Record<string,string>
  expect(contrast(color,style['--on-ink']!)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(color,style['--summary-text']!)).toBeGreaterThanOrEqual(4.5)
  expect(contrast('#fffdf8',style['--brand-primary-text']!)).toBeGreaterThanOrEqual(4.5)
 })
 it.each(['#c05c86','#39865f'])('usa blanco desde el tono medio %s en primario, secundario y acento',color=>{
  expect(readableText(color)).toBe('#ffffff')
  const style=brandingStyle({...DEFAULT_BRANDING,primary_color:color,secondary_color:color,accent_color:color}) as Record<string,string>
  expect(style['--on-ink']).toBe('#ffffff')
  expect(style['--summary-text']).toBe('#ffffff')
  expect(style['--brand-on-accent']).toBe('#ffffff')
 })
 it.each(['#f4a3bc','#b6e8c6','#ffffff'])('conserva texto oscuro en fondos claros %s',color=>{
  expect(readableText(color)).toBe('#000000')
 })
 it('los colores inválidos del servidor no se inyectan como CSS',()=>{
  const style=brandingStyle({...DEFAULT_BRANDING,primary_color:'url(x)',secondary_color:'red',accent_color:';width:0'}) as Record<string,string>
  expect(style['--ink']).toBe(DEFAULT_BRANDING.primary_color)
  expect(style['--tint']).toBe(DEFAULT_BRANDING.secondary_color)
 })
})
