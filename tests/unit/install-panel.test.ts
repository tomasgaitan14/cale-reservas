// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstallPanel } from '../../app/src/components/InstallPanel.tsx'
let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('iPhone')
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  localStorage.clear()
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function render(invitation = false) { await act(async () => root.render(createElement(InstallPanel, { invitation }))) }
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find(item => item.textContent === text)
  if (!button) throw new Error('missing button')
  await act(async () => button.click())
}
describe('instalación guiada del panel', () => {
  it('en iPhone permite posponer sin ocultar la ayuda en Ajustes', async () => {
    await render(true); expect(container.textContent).toContain('Cómo instalar')
    await click('Ahora no'); expect(container.textContent).not.toContain('Cómo instalar')
    await render(false); expect(container.textContent).toContain('Cómo instalar')
  })
  it('en standalone oculta la invitación y confirma el modo instalado en Ajustes', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    await render(true); expect(container.textContent).toBe('')
    await render(false); expect(container.textContent).toContain('app instalada')
  })
  it('la guía muestra Compartir, Agregar a inicio y el dominio definitivo', async () => {
    await render(); await click('Cómo instalar')
    expect(container.querySelector('dialog')?.open).toBe(true)
    expect(container.textContent).toContain('Tocá Compartir')
    expect(container.textContent).toContain('Elegí Agregar a inicio')
    expect(container.querySelector('a')?.href).toBe('https://cale.com.ar/panel')
  })
  it('no invita automáticamente en un navegador de escritorio', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Desktop')
    await render(true); expect(container.textContent).toBe('')
  })
})
