// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
const api=vi.hoisted(()=>({from:vi.fn(),update:vi.fn(),eq:vi.fn(),select:vi.fn(),single:vi.fn()}))
vi.mock('../../app/src/lib/supabase.ts',()=>({supabase:{from:api.from}}))
import { BusinessScreen } from '../../app/src/screens/BusinessScreen.tsx'
const BUSINESS={id:'business-demo',name:'Negocio demo',slug:'negocio-demo',whatsapp:'5493445550101'}
let container:HTMLDivElement
let root:Root
const onChanged=vi.fn()
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.resetAllMocks()
 api.from.mockReturnValue({update:api.update});api.update.mockReturnValue({eq:api.eq});api.eq.mockReturnValue({select:api.select});api.select.mockReturnValue({single:api.single})
 api.single.mockResolvedValue({data:{...BUSINESS,name:'Negocio nuevo'},error:null})
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()})
async function render(){await act(async()=>root.render(createElement(BusinessScreen,{business:BUSINESS,ready:false,onChanged,onServices:vi.fn(),onHours:vi.fn()})))}
async function enter(id:string,value:string){await act(async()=>{const input=container.querySelector<HTMLInputElement>(`#${id}`)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})}
async function submit(){await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))}
describe('guardar cambios del negocio desde la interfaz',()=>{
 it('guarda solo el negocio abierto, normaliza el celular y actualiza la vista con la respuesta',async()=>{
  await render();await enter('edit-business-name','  Negocio nuevo  ');await enter('edit-business-slug','nuevo negocio');await enter('edit-business-whatsapp','+54 9 3445 55 0101');await submit()
  expect(api.update).toHaveBeenCalledWith({name:'Negocio nuevo',slug:'nuevo-negocio',whatsapp:'5493445550101'})
  expect(api.eq).toHaveBeenCalledWith('id',BUSINESS.id)
  expect(onChanged).toHaveBeenCalledWith({...BUSINESS,name:'Negocio nuevo'})
  expect(container.textContent).toContain('Datos guardados.')
 })
 it('un slug reservado muestra el rechazo y conserva lo escrito para corregirlo',async()=>{
  api.single.mockResolvedValue({data:null,error:{code:'23514',message:'slug_reserved'}})
  await render();await enter('edit-business-slug','panel');await submit()
  expect(onChanged).not.toHaveBeenCalled()
  expect(container.querySelector<HTMLInputElement>('#edit-business-slug')!.value).toBe('panel')
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
  expect(container.textContent).not.toContain('Datos guardados.')
 })
})
