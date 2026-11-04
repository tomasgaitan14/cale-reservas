// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ current: vi.fn(), enable: vi.fn(), disable: vi.fn(), test: vi.fn() }))
vi.mock('../../app/src/lib/push.ts', () => ({ pushEnabledForBusiness: api.current, enablePush: api.enable, disablePush: api.disable, testPush: api.test }))
import { PushSettings } from '../../app/src/components/PushSettings.tsx'
let root: Root; let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true); vi.resetAllMocks()
  vi.stubGlobal('Notification',{ permission: 'granted' }); vi.stubGlobal('PushManager',class {})
  Object.defineProperty(navigator,'serviceWorker',{ configurable: true, value: {} })
  vi.spyOn(navigator,'userAgent','get').mockReturnValue('Desktop')
  api.current.mockResolvedValue(false); api.enable.mockResolvedValue(undefined); api.disable.mockResolvedValue(undefined); api.test.mockResolvedValue(undefined)
  container=document.createElement('div'); document.body.append(container); root=createRoot(container)
})
afterEach(async()=>{await act(async()=>root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals()})
async function render(){await act(async()=>root.render(createElement(PushSettings,{ businessId:'business-demo' })))}
async function click(text: string){const button=[...container.querySelectorAll('button')].find(node=>node.textContent===text); if(!button)throw Error('missing button');await act(async()=>button.click())}
describe('ajustes de notificaciones',()=>{
  it('no pide permiso automáticamente y permite activar, probar y desactivar',async()=>{
    await render(); expect(api.enable).not.toHaveBeenCalled()
    await click('Activar notificaciones'); expect(api.enable).toHaveBeenCalledWith('business-demo')
    await click('Enviar prueba'); expect(container.textContent).toContain('Prueba solicitada')
    await click('Desactivar en este dispositivo'); expect(api.disable).toHaveBeenCalledOnce()
    expect(container.textContent).toContain('Activar notificaciones')
  })
  it('si falla la activación no muestra un estado activo',async()=>{
    api.enable.mockRejectedValue(new Error('Permiso denegado'))
    await render(); await click('Activar notificaciones')
    expect(container.textContent).toContain('Permiso denegado');expect(container.textContent).not.toContain('Enviar prueba')
  })
  it('en Safari de iPhone pide instalar primero',async()=>{
    vi.spyOn(navigator,'userAgent','get').mockReturnValue('iPhone')
    await render();expect(container.textContent).toContain('Primero agregá Cale al inicio');expect(api.enable).not.toHaveBeenCalled()
  })
})
