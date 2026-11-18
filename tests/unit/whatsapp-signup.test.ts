// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { launchWhatsAppSignup, loadMetaSdk } from '../../app/src/lib/whatsapp-signup.ts'

const config = { appId: '123', configId: '456', graphVersion: 'v25.0' }
const validSession = JSON.stringify({
  type: 'WA_EMBEDDED_SIGNUP',
  event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
  data: { waba_id: '1234', phone_number_id: '5678' },
})

function startSignup() {
  const login = vi.fn<Parameters<typeof launchWhatsAppSignup>[0]['login']>()
  const controller = new AbortController()
  const result = launchWhatsAppSignup({ init: vi.fn(), login }, config, controller.signal)
  return { result, login }
}

describe('WhatsApp coexistence signup', () => {
  it('waits for Meta to replace its bootstrap before enabling signup', async () => {
    const bootstrap = { init: vi.fn(), login: vi.fn() }
    const readySdk = { init: vi.fn(), login: vi.fn() }
    const meta = window as Window & { FB?: typeof bootstrap; fbAsyncInit?: () => void }
    const loaded = vi.fn()
    const sdk = loadMetaSdk(config)
    void sdk.then(loaded)
    const script = document.querySelector('script[src*="connect.facebook.net"]')!
    try {
      meta.FB = bootstrap
      script.dispatchEvent(new Event('load'))
      await Promise.resolve()
      expect(bootstrap.init).not.toHaveBeenCalled()
      expect(loaded).not.toHaveBeenCalled()
      meta.FB = readySdk
      meta.fbAsyncInit?.()
      await expect(sdk).resolves.toBe(readySdk)
      expect(readySdk.init).toHaveBeenCalledOnce()
    } finally {
      delete meta.FB
      script.remove()
    }
  })

  it('ignores a lookalike origin and waits for both Meta responses', async () => {
    const { result, login } = startSignup()
    expect(login).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ display: 'popup' }))
    login.mock.calls[0]![0]({ authResponse: { code: 'opaque-code' } })
    const completed = vi.fn()
    void result.then(completed)
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://notfacebook.com', data: validSession }))
    await Promise.resolve()
    expect(completed).not.toHaveBeenCalled()

    window.dispatchEvent(new MessageEvent('message', { origin: 'https://www.facebook.com', data: validSession }))
    await expect(result).resolves.toMatchObject({ wabaId: '1234', phoneNumberId: '5678', code: 'opaque-code' })
  })

  it('uses a full-page flow on narrow screens', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    try {
      const { login } = startSignup()
      expect(login).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ display: 'page' }))
    } finally {
      vi.unstubAllGlobals()
    }
  })

})
