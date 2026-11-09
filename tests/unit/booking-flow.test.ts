// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const api=vi.hoisted(()=>({info:vi.fn(),slots:vi.fn(),book:vi.fn()}))
vi.mock('../../app/src/lib/booking-api.ts',()=>({
 BookingLoadError:class extends Error{},fetchBookingInfo:api.info,fetchSlots:api.slots,createBooking:api.book,
}))
vi.mock('../../app/src/components/booking/Turnstile.tsx', () => ({ Turnstile: ({ onToken }: { onToken: (token: string) => void }) => { useEffect(() => { onToken('test-token') }, [onToken]); return null } }))
import { BookingPage } from '../../app/src/screens/BookingPage.tsx'
let container:HTMLDivElement
let root:Root
const DAY='miércoles 4 de noviembre'
const CONFIRMATION={business_name:'Negocio demo',service_name:'Servicio demo',date:'2026-11-04',time:'13:00'}
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
 vi.resetAllMocks()
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{})
 api.info.mockResolvedValue({name:'Negocio demo',slug:'negocio-demo',services:[{id:'service-demo',name:'Servicio demo',duration_minutes:60}],open_days:[1,2,3,4,5]})
 api.slots.mockResolvedValue(['13:00','14:00'])
 api.book.mockResolvedValue({ok:true,confirmation:CONFIRMATION})
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals()})
function button(text:string):HTMLButtonElement {
 const found=[...container.querySelectorAll('button')].find(node=>node.textContent?.trim()===text||node.getAttribute('aria-label')===text)
 if(!found)throw new Error(`No se encontró el botón: ${text}`)
 return found
}
async function click(text:string){await act(async()=>button(text).click())}
async function enter(id:string,value:string){await act(async()=>{
 const node=container.querySelector<HTMLInputElement>(`#${id}`)!
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value)
 node.dispatchEvent(new Event('input',{bubbles:true}))
})}
async function openDetails(){
 await act(async()=>root.render(createElement(BookingPage,{slug:'negocio-demo'})))
 const service=[...container.querySelectorAll('button')].find(node=>node.textContent?.includes('Servicio demo'))!
 await act(async()=>service.click())
 await click(DAY);await click('13:00');await click('Continuar')
}
async function fillDetails(){
 await enter('client-name','Cliente demo');await enter('client-phone','3445 55-0142')
 await act(async()=>container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
}
async function submit(){await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))}
describe('reserva completa desde la interfaz',()=>{
 it('envía los datos normalizados y muestra la confirmación real de la API',async()=>{
  await openDetails();await fillDetails();await submit()
  expect(api.book).toHaveBeenCalledWith({slug:'negocio-demo',serviceId:'service-demo',date:'2026-11-04',time:'13:00',name:'Cliente demo',phone:'5493445550142',consent:true,token:'test-token'})
  expect(container.textContent).toContain('Tu turno quedó reservado')
 })
 it('permite otra reserva, recarga la disponibilidad y limpia datos y consentimiento',async()=>{
  await openDetails();await fillDetails();await submit()
  api.slots.mockResolvedValue(['14:00'])
  await click('Reservar otro turno')
  expect(container.textContent).toContain('¿Qué turno necesitás?')
  expect(container.textContent).not.toContain('Tu turno quedó reservado')
  expect(api.info).toHaveBeenCalledTimes(2)
  const service=[...container.querySelectorAll('button')].find(node=>node.textContent?.includes('Servicio demo'))!
  await act(async()=>service.click());await click(DAY)
  expect(container.textContent).not.toContain('13:00')
  await click('14:00');await click('Continuar')
  expect(container.querySelector<HTMLInputElement>('#client-name')!.value).toBe('')
  expect(container.querySelector<HTMLInputElement>('#client-phone')!.value).toBe('')
  expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false)
  expect(api.book).toHaveBeenCalledTimes(1)
 })
 it('muestra la invitación gratuita y permite abrir el alta sin perder la reserva',async()=>{
  await openDetails()
  expect(container.textContent).toContain('Empezá Gratis y usala sin vencimiento.')
  const link=container.querySelector<HTMLAnchorElement>('footer a')!
  expect(link.href).toBe('https://cale.com.ar/empezar')
  expect(link.target).toBe('_blank')
  expect(link.rel).toContain('noopener')
  await fillDetails();await submit()
  expect(container.querySelector('footer a')).not.toBeNull()
 })
 it('conserva los datos si el cliente vuelve a elegir el horario',async()=>{
  await openDetails();await fillDetails();await click('Cambiar día u hora');await click('Continuar')
  expect(container.querySelector<HTMLInputElement>('#client-name')!.value).toBe('Cliente demo')
  expect(container.querySelector<HTMLInputElement>('#client-phone')!.value).toBe('3445 55-0142')
  expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true)
 })
 it('si el horario se ocupa, actualiza la disponibilidad y conserva los datos para reintentar',async()=>{
  api.book.mockResolvedValueOnce({ok:false,errors:{slot:'Ese horario se acaba de ocupar. Elegí otro.'}})
  await openDetails();await fillDetails()
  api.slots.mockResolvedValue(['14:00'])
  await submit()
  expect(container.textContent).toContain('Ese horario se acaba de ocupar')
  expect(api.slots).toHaveBeenCalledTimes(2)
  await click('14:00');await click('Continuar')
  expect(container.querySelector<HTMLInputElement>('#client-name')!.value).toBe('Cliente demo')
  await submit()
  expect(api.book).toHaveBeenLastCalledWith(expect.objectContaining({time:'14:00',name:'Cliente demo',consent:true}))
 })
 it('sin consentimiento explica qué falta, enfoca la opción y no envía la reserva',async()=>{
  await openDetails();await enter('client-name','Cliente demo');await enter('client-phone','3445 55-0142');await submit()
  expect(api.book).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Marcá la opción de recordatorios por WhatsApp para continuar.')
  expect(document.activeElement?.id).toBe('client-consent')
  await act(async()=>container.querySelector<HTMLInputElement>('#client-consent')!.click())
  expect(container.textContent).not.toContain('Marcá la opción')
  await submit();expect(api.book).toHaveBeenCalledTimes(1)
 })
 it('sin nombre muestra el campo pendiente y conserva los demás datos',async()=>{
  await openDetails();await enter('client-phone','3445 55-0142');await submit()
  expect(api.book).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Escribí tu nombre.')
  expect(document.activeElement?.id).toBe('client-name')
  expect(container.querySelector<HTMLInputElement>('#client-phone')!.value).toBe('3445 55-0142')
 })
 it('ofrece contactar al negocio público sin cancelar ni crear otra reserva',async()=>{
  api.info.mockResolvedValue({...await api.info(),whatsapp:'540000000000'})
  await openDetails();await fillDetails();await submit()
  const link=[...container.querySelectorAll('a')].find(link=>link.textContent?.includes('Contactar al negocio'))!
  expect(link.href).toContain('https://wa.me/540000000000?text=')
  expect(decodeURIComponent(link.href)).toContain('Servicio demo del miércoles 4 de noviembre a las 13:00')
  expect(link.rel).toContain('noopener')
  expect(container.textContent).toContain('Abrir WhatsApp no cambia ni cancela tu reserva.')
  expect(api.book).toHaveBeenCalledTimes(1)
 })
 it('un celular inválido no envía el pedido a la API',async()=>{
  await openDetails();await enter('client-name','Cliente demo');await enter('client-phone','123');await submit()
  expect(api.book).not.toHaveBeenCalled()
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
 })
 it('los errores de datos se muestran sin borrar el formulario',async()=>{
  api.book.mockResolvedValueOnce({ok:false,errors:{name:'Revisá el nombre.'}})
  await openDetails();await fillDetails();await submit()
  expect(container.textContent).toContain('Revisá el nombre.')
  expect(container.querySelector<HTMLInputElement>('#client-name')!.value).toBe('Cliente demo')
 })
})
