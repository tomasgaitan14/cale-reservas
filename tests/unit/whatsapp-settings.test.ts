// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { WhatsAppSettings } from '../../app/src/components/WhatsAppSettings.tsx'
import { SignupError } from '../../app/src/lib/whatsapp-signup.ts'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), launch: vi.fn() }))
vi.mock('../../app/src/lib/supabase.ts', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    functions: { invoke: mocks.invoke },
  },
}))
vi.mock('../../app/src/lib/whatsapp-signup.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../../app/src/lib/whatsapp-signup.ts')>(),
  loadMetaSdk: vi.fn().mockResolvedValue({}),
  launchWhatsAppSignup: mocks.launch,
}))

it('permite reintentar cuando Meta dejó de responder, sin guardar una conexión', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.invoke.mockResolvedValue({ data: { config: { appId: '1', configId: '2', graphVersion: 'v25.0' } }, error: null })
  mocks.launch.mockImplementation((_sdk, _config, signal: AbortSignal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new SignupError('cancelled')), { once: true })
  }))
  const container = document.createElement('div')
  const root = createRoot(container)
  const button = (label: string) => [...container.querySelectorAll('button')].find(item => item.textContent === label)
  try {
    await act(async () => root.render(createElement(WhatsAppSettings, { businessId: 'qa' })))
    await act(async () => button('Configurar WhatsApp')!.click())
    await act(async () => button('Conectar con Meta')!.click())
    expect(button('Conectar con Meta')?.disabled).toBe(true)
    expect(button('Cancelar intento')?.disabled).toBe(false)
    await act(async () => button('Cancelar intento')!.click())
    expect(button('Conectar con Meta')?.disabled).toBe(false)
    await act(async () => button('Conectar con Meta')!.click())
    expect(mocks.launch).toHaveBeenCalledTimes(2)
    expect(mocks.invoke.mock.calls.map(([, options]) => options.body.action)).toEqual(['configuration'])
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
})
