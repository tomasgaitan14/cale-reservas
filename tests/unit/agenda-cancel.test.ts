// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const api=vi.hoisted(()=>({agenda:vi.fn(),counts:vi.fn(),cancel:vi.fn(),services:vi.fn(),hours:vi.fn()}))
vi.mock('../../app/src/lib/supabase.ts',()=>({supabase:{}}))
vi.mock('../../app/src/lib/agenda-api.ts',()=>({fetchAgenda:api.agenda,fetchDayCounts:api.counts,cancelAppointment:api.cancel,deleteTimeBlock:vi.fn(),createOwnerAppointment:vi.fn(),createTimeBlock:vi.fn(),AgendaLoadError:class extends Error{}}))
vi.mock('../../app/src/lib/services.ts',()=>({fetchServices:api.services,ServiceLoadError:class extends Error{}}))
vi.mock('../../app/src/lib/hours-api.ts',()=>({fetchHours:api.hours,HoursLoadError:class extends Error{}}))
vi.mock('../../app/src/components/Modal.tsx',()=>({Modal:({title,children}:{title:string;children:ReactNode})=>createElement('section',{'aria-label':title},children)}))
import { AgendaScreen } from '../../app/src/screens/AgendaScreen.tsx'
import { defaultWeek } from '../../app/src/lib/hours.ts'
let container:HTMLDivElement
let root:Root
let cancelled:boolean
const BUSINESS={id:'business-demo',name:'Negocio demo',slug:'negocio-demo',whatsapp:'540000000000'}
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));vi.resetAllMocks();cancelled=false
 api.hours.mockResolvedValue(defaultWeek());api.services.mockResolvedValue([{id:'service-demo',name:'Servicio demo',duration_minutes:60,active:true}])
 api.agenda.mockImplementation(async()=>({appointments:cancelled?[]:[{id:'appointment-demo',client_name:'Cliente demo',client_phone:null,service_name:'Servicio demo',status:'pending',source:'web',starts_at:'2026-11-03T16:00:00.000Z',ends_at:'2026-11-03T17:00:00.000Z'}],blocks:[]}))
 api.counts.mockImplementation(async()=>({today:cancelled?0:1,tomorrow:0}))
 api.cancel.mockImplementation(async()=>{cancelled=true;return {ok:true}})
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();vi.unstubAllGlobals()})
function button(text:string){const node=[...container.querySelectorAll('button')].find(item=>item.textContent?.trim()===text||item.getAttribute('aria-label')?.includes(text));if(!node)throw new Error(`Falta ${text}`);return node}
async function click(text:string){await act(async()=>button(text).click())}
async function openCancellation(){await act(async()=>root.render(createElement(AgendaScreen,{business:BUSINESS})));await click('Turno de');await click('Cancelar turno')}
describe('cancelación desde la agenda',()=>{
 it('pide confirmación antes de enviar la cancelación',async()=>{
  await openCancellation()
  expect(api.cancel).not.toHaveBeenCalled()
  expect(container.textContent).toContain('¿Cancelar este turno?')
  await click('No');expect(api.cancel).not.toHaveBeenCalled()
 })
 it('al cancelar recarga la agenda y el contador, sin dejar el turno dibujado',async()=>{
  await openCancellation();await click('Sí, cancelar')
  expect(api.cancel).toHaveBeenCalledWith('appointment-demo')
  expect(api.agenda).toHaveBeenLastCalledWith(BUSINESS.id,'2026-11-03','2026-11-03')
  expect(container.querySelector('button[aria-label^="Turno de"]')).toBeNull()
  expect(container.textContent).toContain('Hoy 0 turnos')
  expect(container.textContent).toContain('Turno cancelado.')
 })
 it('si la base rechaza la cancelación mantiene el turno y muestra el error',async()=>{
  api.cancel.mockResolvedValue({ok:false,errors:{general:'No pudimos cancelar este turno.'}})
  await openCancellation();await click('Sí, cancelar')
  expect(container.textContent).toContain('No pudimos cancelar este turno.')
  expect(cancelled).toBe(false)
  expect(container.querySelector('button[aria-label^="Turno de"]')).not.toBeNull()
 })
})
