// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const api=vi.hoisted(()=>({progress:vi.fn(),preferences:vi.fn(),savePreferences:vi.fn(),createService:vi.fn(),services:vi.fn(),hours:vi.fn(),saveHours:vi.fn()}))
vi.mock('../../app/src/lib/supabase.ts',()=>({supabase:{auth:{signOut:vi.fn()}}}))
vi.mock('../../app/src/lib/business.ts',()=>({fetchTeam:async()=>({members:[{user_id:'owner-demo',display_name:'Dueño de prueba',role:'owner'}],invitations:[]}),TeamLoadError:class extends Error{}}))
vi.mock('../../app/src/lib/setup.ts',()=>({fetchSetupProgress:api.progress,SetupLoadError:class extends Error{}}))
vi.mock('../../app/src/lib/preferences.ts',()=>({fetchPreferences:api.preferences,savePreferences:api.savePreferences,PreferencesError:class extends Error{}}))
vi.mock('../../app/src/lib/services.ts',()=>({fetchServices:api.services,createService:api.createService,updateService:vi.fn(),deleteService:vi.fn(),ServiceLoadError:class extends Error{}}))
vi.mock('../../app/src/lib/hours-api.ts',()=>({fetchHours:api.hours,saveHours:api.saveHours,HoursLoadError:class extends Error{}}))
vi.mock('../../app/src/screens/AgendaScreen.tsx',()=>({AgendaScreen:()=>createElement('h1',null,'Agenda del negocio')}))
import { Panel } from '../../app/src/screens/Panel.tsx'
import { emptyWeek } from '../../app/src/lib/hours.ts'
import type { Preferences } from '../../app/src/lib/preferences.ts'
let container:HTMLDivElement
let root:Root
let progress:{serviceCount:number;hasHours:boolean;upcomingCount:number}
let preferences:Preferences
const BUSINESS={id:'business-demo',name:'Negocio demo',slug:'negocio-demo',whatsapp:'540000000000'}
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.resetAllMocks();window.history.replaceState({},'','/panel')
 progress={serviceCount:0,hasHours:false,upcomingCount:0}
 preferences={business_id:BUSINESS.id,reminder_hours:24,whatsapp_waitlist:false,reminders_reviewed:false,onboarding_completed:false,allow_cross_professional_overlap:true}
 api.progress.mockImplementation(async()=>({...progress}))
 api.preferences.mockImplementation(async()=>({...preferences}))
 api.savePreferences.mockImplementation(async(value:Preferences)=>{preferences={...value}})
 api.services.mockResolvedValue([]);api.hours.mockImplementation(async()=>emptyWeek())
 api.createService.mockImplementation(async()=>{progress.serviceCount=1;return {ok:true}})
 api.saveHours.mockImplementation(async()=>{progress.hasHours=true;return {ok:true}})
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()})
async function render(){await act(async()=>root.render(createElement(Panel,{business:BUSINESS})))}
async function click(text:string){await act(async()=>{
 const button=[...container.querySelectorAll('button')].find(node=>node.textContent?.trim()===text)
 if(!button)throw new Error(`No se encontró ${text}`)
 button.click()
})}
async function addService(){await act(async()=>{
 const input=container.querySelector<HTMLInputElement>('#service-name')!
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Servicio de prueba')
 input.dispatchEvent(new Event('input',{bubbles:true}))
});await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))}
async function remount(){await act(async()=>root.unmount());root=createRoot(container);await render()}
describe('alta guiada con avance persistido',()=>{
 it('completa servicio y horarios y llega a la agenda sin configurar funciones futuras',async()=>{
  await render();expect(container.textContent).toContain('Empecemos por un servicio')
  await addService();expect(container.textContent).toContain('Tus horarios')
  await click('Guardar y continuar')
  expect(api.saveHours).toHaveBeenCalledWith(BUSINESS.id,'owner-demo',expect.objectContaining({1:[{start:'09:00',end:'18:00'}],5:[{start:'09:00',end:'18:00'}],0:[],6:[]}))
  expect(container.textContent).not.toContain('Un recordatorio,menos olvidos.')
  expect(preferences.reminders_reviewed).toBe(false)
  expect(container.textContent).toContain('Tu agenda ya tiene su lugar')
  await click('Ir a mi agenda');expect(preferences.onboarding_completed).toBe(true)
  expect(container.textContent).toContain('Agenda del negocio')
  expect(api.progress).toHaveBeenCalledWith(BUSINESS.id)
 })
 it('después de salir retoma horarios sin volver a crear el servicio',async()=>{
  await render();await addService();await remount()
  expect(container.textContent).toContain('Tus horarios')
  expect(api.createService).toHaveBeenCalledTimes(1)
  expect(container.textContent).not.toContain('Empecemos por un servicio')
 })
 it('un rechazo al guardar el servicio conserva el paso y muestra el motivo',async()=>{
  api.createService.mockResolvedValue({ok:false,errors:{name:'Ya existe un servicio con ese nombre.'}})
  await render();await addService()
  expect(container.textContent).toContain('Ya existe un servicio con ese nombre')
  expect(container.textContent).toContain('Empecemos por un servicio')
  expect(api.saveHours).not.toHaveBeenCalled()
 })
 it('un rechazo de horarios no avanza a recordatorios',async()=>{
  progress.serviceCount=1
  api.saveHours.mockResolvedValue({ok:false,message:'No pudimos guardar los horarios.'})
  await render();await click('Guardar y continuar')
  expect(container.textContent).toContain('No pudimos guardar los horarios')
  expect(container.textContent).toContain('Tus horarios')
  expect(api.savePreferences).not.toHaveBeenCalled()
 })
 it('si después del alta faltan servicios activos, ofrece repararlo sin reiniciar el asistente',async()=>{
  preferences.onboarding_completed=true
  await render()
  expect(container.textContent).toContain('Tu página necesita al menos un servicio activo')
  await click('Revisar servicios')
  expect(container.textContent).toContain('Tus servicios')
  expect(container.textContent).not.toContain('Paso 3 de 5')
 })

})
