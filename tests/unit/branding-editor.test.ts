// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot,type Root } from 'react-dom/client'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
const api=vi.hoisted(()=>({fetch:vi.fn(),save:vi.fn(),prepare:vi.fn(),upload:vi.fn(),remove:vi.fn()}))
vi.mock('../../app/src/lib/branding-api.ts',()=>({fetchBranding:api.fetch,saveBranding:api.save,prepareLogo:api.prepare,uploadLogo:api.upload,removeLogo:api.remove,logoUrl:(path:string|null)=>path?'https://example.invalid/logo.png':null}))
import { BusinessBranding } from '../../app/src/components/BusinessBranding.tsx'
import { DEFAULT_BRANDING } from '../../app/src/lib/branding.ts'
let root:Root;let container:HTMLDivElement
beforeEach(()=>{
 vi.resetAllMocks();
 vi.stubGlobal('URL',Object.assign(class extends URL {},{createObjectURL:vi.fn(()=> 'blob:preview'),revokeObjectURL:vi.fn()}));
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);api.fetch.mockResolvedValue({...DEFAULT_BRANDING});api.save.mockResolvedValue(undefined)
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()})
async function render(){await act(async()=>root.render(createElement(BusinessBranding,{businessId:'business-demo',name:'Negocio demo'})))}
async function click(text:string){const button=[...container.querySelectorAll('button')].find(node=>node.textContent===text);if(!button)throw Error('missing button');await act(async()=>button.click())}
describe('editor de marca del negocio',()=>{
 it('abre el selector con Subir logo y muestra la miniatura junto a Cambiar logo sin publicar',async()=>{
  api.prepare.mockResolvedValue(new Blob(['png']))
  await render()
  const input=container.querySelector<HTMLInputElement>('#business-logo')!
  const select=vi.spyOn(input,'click').mockImplementation(()=>{})
  await click('Subir logo');expect(select).toHaveBeenCalledOnce()
  Object.defineProperty(input,'files',{value:[new File(['png'],'logo.png',{type:'image/png'})]})
  await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})))
  expect(container.querySelector<HTMLImageElement>('.branding-logo-preview img')?.getAttribute('src')).toBe('blob:preview')
  expect(container.textContent).toContain('Cambiar logo');expect(container.textContent).toContain('Logo listo')
  expect(api.upload).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled()
  await click('Quitar logo');expect(container.querySelector('.branding-logo-preview img')).toBeNull()
  expect(container.textContent).toContain('Subir logo')
 })
 it('la paleta cambia la vista previa sin publicar hasta guardar',async()=>{
  await render();await click('Terracota');expect(api.save).not.toHaveBeenCalled()
  expect(container.querySelector<HTMLInputElement>('#brand-primary_color')!.value).toBe('#8a4535')
  await click('Guardar diseño');expect(api.save).toHaveBeenCalledWith('business-demo',expect.objectContaining({primary_color:'#8a4535'}))
  expect(container.textContent).toContain('Diseño guardado')
 })
 it('restaurar prepara los valores originales y quitar logo no borra antes de guardar',async()=>{
  api.fetch.mockResolvedValue({...DEFAULT_BRANDING,logo_path:'old-logo'})
  await render();await click('Quitar logo');expect(api.remove).not.toHaveBeenCalled()
  await click('Restaurar diseño original');expect(api.save).not.toHaveBeenCalled()
  await click('Guardar diseño');expect(api.save).toHaveBeenCalledWith('business-demo',DEFAULT_BRANDING);expect(api.remove).toHaveBeenCalledWith('old-logo')
 })
 it('no borra el logo recién guardado si falla la limpieza del anterior',async()=>{
  api.fetch.mockResolvedValue({...DEFAULT_BRANDING,logo_path:'old-logo'});api.prepare.mockResolvedValue(new Blob(['png']));api.upload.mockResolvedValue('new-logo');api.remove.mockRejectedValue(new Error('Falló limpieza'))
  await render()
  const input=container.querySelector<HTMLInputElement>('#business-logo')!
  Object.defineProperty(input,'files',{value:[new File(['png'],'logo.png',{type:'image/png'})]})
  await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})))
  await click('Guardar diseño')
  expect(api.save).toHaveBeenCalledWith('business-demo',expect.objectContaining({logo_path:'new-logo'}))
  expect(api.remove).toHaveBeenCalledTimes(1);expect(api.remove).toHaveBeenCalledWith('old-logo')
 })
 it('conserva el logo nuevo si se perdió la respuesta pero el servidor lo guardó',async()=>{
  api.fetch.mockResolvedValueOnce({...DEFAULT_BRANDING,logo_path:'old-logo'}).mockResolvedValue({...DEFAULT_BRANDING,logo_path:'new-logo'})
  api.prepare.mockResolvedValue(new Blob(['png']));api.upload.mockResolvedValue('new-logo');api.save.mockRejectedValue(new Error('Respuesta perdida'))
  await render()
  const input=container.querySelector<HTMLInputElement>('#business-logo')!
  Object.defineProperty(input,'files',{value:[new File(['png'],'logo.png',{type:'image/png'})]})
  await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})))
  await click('Guardar diseño');expect(api.remove).not.toHaveBeenCalled()
 })
 it('si falla el guardado conserva la imagen anterior y el borrador',async()=>{
  api.fetch.mockResolvedValue({...DEFAULT_BRANDING,logo_path:'old-logo'});api.save.mockRejectedValue(new Error('No se guardó'))
  await render();await click('Quitar logo');await click('Guardar diseño')
  expect(api.remove).not.toHaveBeenCalled();expect(container.textContent).toContain('No se guardó')
 })
})
