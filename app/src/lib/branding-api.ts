import { supabase } from './supabase.ts'
import { DEFAULT_BRANDING, validColor, validLogoPath, type Branding } from './branding.ts'
const client=supabase
export async function fetchBranding(businessId: string): Promise<Branding> {
  const {data,error}=await client.rpc('get_business_branding',{p_business_id:businessId})
  if(error)throw new Error('No pudimos cargar la personalización. Probá nuevamente.')
  return data ? data as unknown as Branding : {...DEFAULT_BRANDING}
}
export function logoUrl(path: string | null): string | null {
  if(!path || !validLogoPath(path))return null
  return supabase.storage.from('business-logos').getPublicUrl(path).data.publicUrl
}
export async function saveBranding(businessId: string, value: Branding): Promise<void> {
  if(![value.primary_color,value.secondary_color,value.accent_color].every(validColor))throw new Error('Usá colores con formato #RRGGBB.')
  if(value.logo_path && !validLogoPath(value.logo_path,businessId))throw new Error('El logo no corresponde a este negocio.')
  // Postgres admite NULL en este argumento; el generador de tipos no lo refleja.
  const {error}=await client.rpc('save_business_branding',{p_business_id:businessId,p_primary:value.primary_color,p_secondary:value.secondary_color,p_accent:value.accent_color,p_logo_path:value.logo_path as string})
  if(error)throw new Error('No pudimos guardar el diseño. Probá nuevamente.')
}
// Decodificar y volver a dibujar elimina metadatos y evita publicar SVG o archivos originales.
export async function prepareLogo(file: File): Promise<Blob> {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Elegí un logo PNG, JPG o WebP.')
  if(file.size>5*1024*1024)throw new Error('El archivo puede pesar hasta 5 MB.')
  let bitmap: ImageBitmap
  try { bitmap=await createImageBitmap(file) } catch { throw new Error('No pudimos leer esa imagen. Probá con otro archivo.') }
  try {
    if(bitmap.width>8192 || bitmap.height>8192 || !bitmap.width || !bitmap.height)throw new Error('La imagen debe medir como máximo 8192 píxeles por lado.')
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512
    const context=canvas.getContext('2d');if(!context)throw new Error('No pudimos preparar el logo.')
    const scale=Math.min(512/bitmap.width,512/bitmap.height)
    const width=bitmap.width*scale,height=bitmap.height*scale
    context.drawImage(bitmap,(512-width)/2,(512-height)/2,width,height)
    const result=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'))
    if(!result || result.size>1024*1024)throw new Error('No pudimos optimizar el logo. Probá con una imagen más simple.')
    return result
  } finally { bitmap.close() }
}
export async function uploadLogo(businessId: string, image: Blob): Promise<string> {
  const path=`${businessId}/${crypto.randomUUID()}.png`
  const {error}=await supabase.storage.from('business-logos').upload(path,image,{contentType:'image/png',upsert:false,cacheControl:'3600'})
  if(error)throw new Error('No pudimos subir el logo. Probá nuevamente.')
  return path
}
export async function removeLogo(path: string): Promise<void> {
  const {error}=await supabase.storage.from('business-logos').remove([path])
  if(error)throw new Error('El diseño se guardó, pero no pudimos limpiar el archivo anterior.')
}
