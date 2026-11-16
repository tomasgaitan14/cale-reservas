// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('../../app/src/lib/supabase.ts', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: 'user-a' } } }) } } }))
vi.mock('../../app/src/components/Modal.tsx', () => ({ Modal: ({ children, title }: { children: import('react').ReactNode; title: string }) => createElement('div', {}, createElement('h2', {}, title), children) }))
vi.mock('../../app/src/screens/ServicesScreen.tsx', () => ({ ServicesScreen: ({ onContinue }: { onContinue: () => void }) => createElement('button', { onClick: onContinue }, 'Simular servicio guardado') }))
vi.mock('../../app/src/screens/HoursScreen.tsx', () => ({ HoursScreen: () => createElement('p', {}, 'Editor de horarios') }))
vi.mock('../../app/src/components/BusinessBranding.tsx', () => ({ BusinessBranding: () => null }))
vi.mock('../../app/src/components/ShareBooking.tsx', () => ({ ShareBooking: () => null }))
import { GuidedSetup } from '../../app/src/components/GuidedSetup.tsx'
let root: Root
let container: HTMLDivElement
const key = 'cale:guided-setup:v1:user-a:business-a'
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.clear()
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function render(plan: 'gratis' | 'pro' = 'gratis') {
  await act(async () => root.render(createElement(GuidedSetup, { business: { id: 'business-a', name: 'Demo', slug: 'demo', whatsapp: '5493446000000', role: 'owner', plan }, progress: { serviceCount: 0, hasHours: false, upcomingCount: 0 }, onPause: vi.fn(), onComplete: vi.fn(), busy: false, error: '' })))
}
async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find(node => node.textContent === label)!
  expect(button).toBeTruthy()
  await act(async () => button.click())
}
it.each(['gratis', 'pro'] as const)('guía una acción real y persiste su avance para %s', async plan => {
  await render(plan)
  await click('Empezar')
  await click('Crear mi servicio')
  expect(localStorage.getItem(key)).toBe('1')
  await click('Simular servicio guardado')
  expect(localStorage.getItem(key)).toBe('2')
  expect(container.textContent).toContain('Elegí cuándo atendés')
})
it('retoma el paso de esta cuenta y este negocio', async () => {
  localStorage.setItem(key, '2')
  await render()
  expect(container.textContent).toContain('Elegí cuándo atendés')
})
it('ignora progreso de otra cuenta', async () => {
  localStorage.setItem('cale:guided-setup:v1:other:business-a', '4')
  await render()
  expect(container.textContent).toContain('¡Bienvenido a Cale!')
})
