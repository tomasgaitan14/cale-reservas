export type SignupConfig = { appId: string; configId: string; graphVersion: string }
type MetaAuthResponse = { authResponse?: { code?: string } }
type MetaSdk = {
  init(options: { appId: string; version: string; autoLogAppEvents: false; xfbml: false }): void
  login(callback: (response: MetaAuthResponse) => void, options: {
    config_id: string
    response_type: 'code'
    override_default_response_type: true
    display: 'popup' | 'page'
    extras: { version: 'v4'; setup: Record<string, never>; sessionInfoVersion: '3'; featureType: 'whatsapp_business_app_onboarding' }
  }): void
}
type SignupAssets = { wabaId: string; phoneNumberId?: string; metaBusinessId?: string }
export type SignupResult = SignupAssets & { code: string }
export class SignupError extends Error {
  constructor(readonly reason: 'cancelled' | 'failed' | 'not_coexistence' | 'incomplete') {
    super(reason)
  }
}

const metaOrigins = new Set(['https://www.facebook.com', 'https://web.facebook.com', 'https://facebook.com'])
let sdkPromise: Promise<MetaSdk> | undefined

function signupDisplay(): 'popup' | 'page' {
  return window.matchMedia?.('(max-width: 767px)').matches ? 'page' : 'popup'
}

export function loadMetaSdk(config: SignupConfig): Promise<MetaSdk> {
  const meta = window as Window & { FB?: MetaSdk; fbAsyncInit?: () => void }
  sdkPromise ??= new Promise<MetaSdk>((resolve, reject) => {
    const script = document.createElement('script')
    const previousInit = meta.fbAsyncInit
    const cleanUp = () => {
      clearTimeout(timeout)
      if (meta.fbAsyncInit === initialize) meta.fbAsyncInit = previousInit
    }
    function fail() {
      cleanUp()
      script.remove()
      reject(new SignupError('failed'))
    }
    function initialize() {
      const sdk = meta.FB
      if (!sdk) return fail()
      try {
        sdk.init({ appId: config.appId, version: config.graphVersion, autoLogAppEvents: false, xfbml: false })
        cleanUp()
        resolve(sdk)
      } catch {
        fail()
      }
    }
    const timeout = window.setTimeout(fail, 10_000)
    // The first script exposes a placeholder FB object and loads the full SDK separately.
    meta.fbAsyncInit = initialize
    script.src = 'https://connect.facebook.net/es_LA/sdk.js'
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onerror = fail
    document.head.append(script)
  }).catch((error: unknown) => {
    sdkPromise = undefined
    throw error
  })
  return sdkPromise
}

function metaId(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{1,32}$/.test(value) ? value : undefined
}

export function launchWhatsAppSignup(sdk: MetaSdk, config: SignupConfig, signal: AbortSignal): Promise<SignupResult> {
  return new Promise((resolve, reject) => {
    let code: string | undefined
    let assets: SignupAssets | undefined
    let callbackTimer: number | undefined
    let settled = false
    const timeout = window.setTimeout(() => fail('incomplete'), 15 * 60_000)

    function cleanUp() {
      settled = true
      clearTimeout(timeout)
      clearTimeout(callbackTimer)
      window.removeEventListener('message', onMessage)
      signal.removeEventListener('abort', abort)
    }
    function fail(reason: SignupError['reason']) {
      cleanUp()
      reject(new SignupError(reason))
    }
    function finish() {
      if (!code || !assets) return
      cleanUp()
      resolve({ code, ...assets })
    }
    function abort() { fail('cancelled') }
    function onMessage(event: MessageEvent) {
      if (!metaOrigins.has(event.origin) || typeof event.data !== 'string') return
      let message
      try { message = JSON.parse(event.data) } catch { return }
      if (message?.type !== 'WA_EMBEDDED_SIGNUP') return
      if (message.event === 'CANCEL') return fail('cancelled')
      if (message.event === 'ERROR') return fail('failed')
      if (message.event !== 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
        if (typeof message.event === 'string' && message.event.startsWith('FINISH')) fail('not_coexistence')
        return
      }
      const wabaId = metaId(message.data?.waba_id)
      if (!wabaId) return fail('incomplete')
      assets = { wabaId, phoneNumberId: metaId(message.data?.phone_number_id), metaBusinessId: metaId(message.data?.business_id) }
      finish()
    }

    if (signal.aborted) return abort()
    signal.addEventListener('abort', abort, { once: true })
    window.addEventListener('message', onMessage)
    try {
      sdk.login(response => {
        if (settled) return
        code = response?.authResponse?.code
        finish()
        // Meta manda los identificadores y el código por canales separados y en cualquier orden.
        if (!code || !assets) callbackTimer = window.setTimeout(() => fail(assets || code ? 'incomplete' : 'cancelled'), 5_000)
      }, {
        config_id: config.configId,
        response_type: 'code',
        override_default_response_type: true,
        display: signupDisplay(),
        extras: { version: 'v4', setup: {}, sessionInfoVersion: '3', featureType: 'whatsapp_business_app_onboarding' },
      })
    } catch {
      fail('failed')
    }
  })
}
