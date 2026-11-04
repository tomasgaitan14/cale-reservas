import { useEffect, useRef, useState } from 'react'
import { BRAND_PALETTES, DEFAULT_BRANDING, brandingStyle, validColor, type Branding } from '../lib/branding.ts'
import { fetchBranding, logoUrl, prepareLogo, removeLogo, saveBranding, uploadLogo } from '../lib/branding-api.ts'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './ui.ts'

export function BusinessBranding({businessId,name}:{businessId:string;name:string}) {
  const [draft,setDraft]=useState<Branding>({...DEFAULT_BRANDING})
  const [saved,setSaved]=useState<Branding|null>(null)
  const [image,setImage]=useState<Blob|null>(null)
  const [preview,setPreview]=useState<string|null>(null)
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')
  const [attempt,setAttempt]=useState(0)
  const version=useRef(0)
  useEffect(()=>{let active=true;setSaved(null);setNotice('');fetchBranding(businessId).then(value=>{if(active){setSaved(value);setDraft(value)}}).catch(cause=>{if(active)setNotice(cause.message)});return()=>{active=false;version.current++}},[businessId,attempt])
  useEffect(()=>{if(!image){setPreview(null);return}const url=URL.createObjectURL(image);setPreview(url);return()=>URL.revokeObjectURL(url)},[image])
  async function choose(file?:File){if(!file)return;const current=++version.current;setBusy(true);setNotice('');try{const blob=await prepareLogo(file);if(current===version.current)setImage(blob)}catch(cause){if(current===version.current)setNotice((cause as Error).message)}finally{if(current===version.current)setBusy(false)}}
  async function save(){if(!saved)return;setBusy(true);setNotice('');let uploaded:string|null=null;let committed=false
    try{
      if(image)uploaded=await uploadLogo(businessId,image)
      const value={...draft,logo_path:uploaded??draft.logo_path}
      await saveBranding(businessId,value);committed=true
      setSaved(value);setDraft(value);setImage(null);setNotice('Diseño guardado. Ya se ve en tu página de reservas.')
      if(saved.logo_path && saved.logo_path!==value.logo_path)await removeLogo(saved.logo_path)
    }catch(cause){
      if(uploaded&&!committed){try{const current=await fetchBranding(businessId);if(current.logo_path!==uploaded)await removeLogo(uploaded)}catch{/* Ante un resultado incierto se conserva el archivo, para no borrar un logo que sí quedó guardado. */}}
      setNotice((cause as Error).message)
    }finally{setBusy(false)}
  }
  const logo=preview??logoUrl(draft.logo_path)
  const colorsValid=[draft.primary_color,draft.secondary_color,draft.accent_color].every(validColor)
  return <section className="branding-editor" aria-labelledby="branding-title">
    <div><p className="eyebrow">Personalización</p><h2 id="branding-title" className="text-2xl">Tu página, con tu identidad.</h2><p className="mt-3 text-muted">Logo y colores para la página de reservas. El panel de Cale conserva su diseño.</p></div>
    <div className="warm-split">
      <div className="flex min-w-0 flex-col items-start gap-6">
        <fieldset disabled={busy||!saved} className="flex w-full min-w-0 flex-col gap-6">
          <div className="flex flex-col items-start gap-3"><label htmlFor="business-logo" className="font-semibold">Logo del negocio</label><input id="business-logo" type="file" accept="image/png,image/jpeg,image/webp" className="w-full min-w-0 text-sm" onChange={event=>{void choose(event.target.files?.[0]);event.target.value=''}}/><p className="text-sm text-muted">PNG, JPG o WebP, hasta 5 MB. Lo adaptamos a un cuadrado sin deformarlo. El logo será público.</p>
          {(logo||image) && <button type="button" className={SECONDARY_BUTTON} onClick={()=>{version.current++;setImage(null);setDraft(value=>({...value,logo_path:null}))}}>Quitar logo</button>}</div>
          <div><p className="mb-3 font-semibold">Un punto de partida</p><div className="flex flex-wrap gap-2">{BRAND_PALETTES.map(palette=><button type="button" key={palette.name} className={SECONDARY_BUTTON} onClick={()=>setDraft(value=>({...value,...palette}))}>{palette.name}</button>)}</div></div>
          {([['primary_color','Primario','Botones y selecciones'],['secondary_color','Secundario','Fondos suaves y resumen'],['accent_color','Acento','Pasos y detalles destacados']] as const).map(([key,label,hint])=><div key={key} className="flex flex-col gap-2"><label htmlFor={`brand-${key}`} className="font-semibold">{label}</label><div className="flex items-center gap-3"><input aria-label={`Elegir color ${label.toLowerCase()}`} type="color" value={validColor(draft[key])?draft[key]:DEFAULT_BRANDING[key]} onChange={event=>setDraft(value=>({...value,[key]:event.target.value}))} className="h-12 w-14 cursor-pointer rounded-lg border border-line p-1"/><input id={`brand-${key}`} value={draft[key]} maxLength={7} spellCheck={false} className="h-12 min-w-0 flex-1 rounded-lg border border-field-line bg-surface px-3" aria-invalid={!validColor(draft[key])} onChange={event=>setDraft(value=>({...value,[key]:event.target.value}))}/></div><p className="text-sm text-muted">{hint}</p></div>)}
          <p className="text-sm text-muted">Ajustamos el color de los textos para que se lean bien sobre tu paleta.</p>
          <div className="flex flex-wrap gap-3"><button type="button" className={PRIMARY_BUTTON} disabled={!colorsValid} onClick={()=>void save()}>Guardar diseño</button><button type="button" className={SECONDARY_BUTTON} onClick={()=>{setImage(null);setDraft({...DEFAULT_BRANDING})}}>Restaurar diseño original</button></div>
          <p className="text-sm text-muted">Los cambios se publican al tocar Guardar diseño.</p>
        </fieldset>
        {!saved && <button className={SECONDARY_BUTTON} disabled={busy} onClick={()=>setAttempt(value=>value+1)}>Reintentar carga</button>}
        {notice&&<p role="status">{notice}</p>}
      </div>
      <div className="branding-preview booking-brand-theme" style={brandingStyle(draft)} aria-label="Vista previa del diseño">
        <p className="text-sm text-muted">Vista previa · no crea reservas</p>
        <div className="flex items-center gap-4">{logo&&<img src={logo} alt={`Logo de ${name}`} className="size-20 rounded-xl bg-white object-contain p-1"/>}<h3 className="break-words text-2xl">{name}</h3></div>
        <div className="booking-progress"><span className="brand-preview-step">1</span><p>Elegí tu turno</p></div>
        <div className="booking-summary rounded-xl bg-tint p-5"><p>Tu servicio</p><p className="mt-2 font-semibold">Corte de pelo · 30 min</p></div>
        <div className="flex gap-3"><span className="rounded-xl bg-ink px-5 py-3 text-on-ink">09:00</span><span className="rounded-xl border border-line px-5 py-3">10:00</span></div>
        <span className={`${PRIMARY_BUTTON} pointer-events-none`}>Reservar turno</span>
      </div>
    </div>
  </section>
}
