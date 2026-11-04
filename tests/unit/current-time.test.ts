// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DayGrid } from '../../app/src/components/agenda/DayGrid.tsx'
import { emptyWeek } from '../../app/src/lib/hours.ts'
let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T15:30:00Z'))
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })
async function render(dates = ['2026-11-04'], range = {start: 540, end: 1080}) {
  await act(async () => root.render(createElement(DayGrid, { dates, today: '2026-11-04', range, hours: emptyWeek(), itemsByDate: {}, onEmptyClick: vi.fn(), onItemClick: vi.fn() })))
}
describe('hora actual en agenda', () => {
  it('ubica la hora argentina y avanza sin recargar la agenda', async () => {
    await render()
    const marker = container.querySelector<HTMLElement>('[role="img"]')!
    expect(marker.getAttribute('aria-label')).toBe('Hora actual: 12:30')
    expect(marker.style.top).toBe('182px')
    await act(async () => vi.advanceTimersByTime(60_000))
    expect(marker.getAttribute('aria-label')).toBe('Hora actual: 12:31')
    expect(parseFloat(marker.style.top)).toBeGreaterThan(182)
  })
  it('marca solo hoy en semana y no muestra marcas en otros días', async () => {
    await render(['2026-11-03','2026-11-04','2026-11-05'])
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(1)
    await render(['2026-11-05'])
    expect(container.querySelector('[role="img"]')).toBeNull()
  })
  it('no dibuja fuera del rango visible', async () => {
    await render(['2026-11-04'], {start: 780, end: 1080})
    expect(container.querySelector('[role="img"]')).toBeNull()
  })
  it('al volver a la app recupera la hora sin esperar el próximo minuto', async () => {
    await render(); vi.setSystemTime(new Date('2026-11-04T16:45:00Z'))
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Hora actual: 13:45')
  })
})
