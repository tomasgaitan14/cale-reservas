// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const api=vi.hoisted(()=>({enabled:vi.fn(),enable:vi.fn()}))
vi.mock('../../app/src/lib/push.ts',()=>({pushEnabledForBusiness:api.enabled,enablePush:api.enable}))
import { PushInvitation } from '../../app/src/components/PushInvitation.tsx'
let root:Root;let container:HTMLDivElement;let businessId:string;let serial=0
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.resetAllMocks();localStorage.clear();businessId=`business-${++serial}`
 vi.stubGlobal('Notification',{permission:'default'});vi.stubGlobal('PushManager',class {})
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{}})
 vi.spyOn(navigator,'userAgent','get').mockReturnValue('iPhone')
 vi.stubGlobal('matchMedia',()=>({matches:true}))
 HTMLDialogElement.prototype.showModal=function(){this.open=true}
 api.enabled.mockResolvedValue(false);api.enable.mockResolvedValue(undefined)
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals()})
async function render(){await act(async()=>root.render(createElement(PushInvitation,{businessId})))}
async function click(text:string){const button=[...container.querySelectorAll('button')].find(node=>node.textContent===text);if(!button)throw Error('missing button');await act(async()=>button.click())}
describe('invitación de notificaciones al registrar el negocio',()=>{
 it('aparece por defecto y solo solicita activar después del clic',async()=>{
  await render();expect(container.textContent).toContain('Activar notificaciones');expect(api.enable).not.toHaveBeenCalled()
  await click('Activar notificaciones');expect(api.enable).toHaveBeenCalledWith(businessId);expect(container.querySelector('dialog')).toBeNull()
 })
 it('Ahora no persiste la decisión sin cambiar la suscripción',async()=>{
  await render();await click('Ahora no');expect(api.enable).not.toHaveBeenCalled()
  expect(localStorage.getItem(`cale-push-invitation-v1:${businessId}:app`)).toBe('1')
  await act(async()=>root.unmount());root=createRoot(container);await render();expect(container.querySelector('dialog')).toBeNull()
 })
 it('no aparece si el negocio ya tiene avisos en este dispositivo',async()=>{
  api.enabled.mockResolvedValue(true);await render();expect(container.querySelector('dialog')).toBeNull()
 })
 it('en Safari del iPhone explica instalar antes y no pide permiso',async()=>{
  vi.stubGlobal('matchMedia',()=>({matches:false}));await render()
  expect(container.textContent).toContain('Primero agregá Cale al inicio');expect(container.textContent).not.toContain('Activar notificaciones')
  expect(api.enable).not.toHaveBeenCalled()
 })
 it('muestra un error si falla la activación sin darla por hecha',async()=>{
  api.enable.mockRejectedValue(new Error('Permiso denegado'));await render();await click('Activar notificaciones')
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('Permiso denegado');expect(container.querySelector('dialog')).not.toBeNull()
 })
})
