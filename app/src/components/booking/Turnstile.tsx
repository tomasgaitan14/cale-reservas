import { useEffect, useRef, useState } from 'react'

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global { interface Window { turnstile?: TurnstileApi } }
let loading: Promise<void> | undefined
function loadWidget() {
  if (window.turnstile) return Promise.resolve()
  if (!loading) loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => window.turnstile ? resolve() : reject(new Error('widget_unavailable'))
    script.onerror = () => { script.remove(); loading = undefined; reject(new Error('widget_unavailable')) }
    document.head.append(script)
  })
  return loading
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let widget: string | undefined
    onToken('')
    setFailed(false)
    loadWidget().then(() => {
      if (!active || !container.current) return
      widget = window.turnstile!.render(container.current, {
        sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
        action: 'booking', theme: 'light', size: 'flexible',
        callback: (token: string) => { if (active) { onToken(token); setFailed(false) } },
        'expired-callback': () => { if (active) onToken('') },
        'error-callback': () => { if (active) { onToken(''); setFailed(true) } },
      })
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false; if (widget !== undefined) window.turnstile?.remove(widget) }
  }, [attempt, onToken])
  return <div className="flex flex-col gap-2">
    <div ref={container} />
    {failed && <p role="alert" className="text-sm text-warn">No pudimos completar la verificación. <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></p>}
  </div>
}
