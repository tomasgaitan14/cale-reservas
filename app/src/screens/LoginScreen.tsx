import { LegalLinks } from '../components/LegalLinks.tsx'
import { GoogleLogo, WarningCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import { PRIMARY_BUTTON } from '../components/ui.ts'
import { authRedirectUrl } from '../lib/auth.ts'
import { supabase } from '../lib/supabase.ts'

const GENERIC_ERROR = 'No pudimos entrar. Probá de nuevo en un momento.'

export function LoginScreen() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function signInWithGoogle() {
    setBusy(true)
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectUrl(window.location.origin) },
    })
    if (oauthError) {
      setError(GENERIC_ERROR)
      setBusy(false)
    }
  }

  return (
    <div className="grid items-start gap-10 md:grid-cols-[1.15fr_0.85fr] md:gap-16">
      <div className="rise-in flex flex-col gap-5 pt-2 md:pt-10" style={{ '--i': 0 } as React.CSSProperties}>
        <p className="eyebrow">Paso 1 de 5 · Tu cuenta</p>
        <h1 className="text-[1.875rem] md:text-[2.75rem] md:leading-[1.05]">
          Entrá o creá tu cuenta <span className="text-muted">con Google.</span>
        </h1>
        <p className="max-w-[34ch] text-[1.1875rem] text-muted">
          Cargá tus servicios y horarios, compartí tu link y gestioná las reservas desde tu agenda. Los recordatorios por WhatsApp estarán disponibles próximamente.
        </p>
      </div>

      <div
        className="rise-in flex flex-col gap-6 rounded-[1.25rem] border border-line bg-surface p-6 md:p-8"
        style={{ '--i': 1 } as React.CSSProperties}
      >
        <button type="button" className={PRIMARY_BUTTON} onClick={signInWithGoogle} disabled={busy}>
          <GoogleLogo weight="bold" className="size-6" aria-hidden="true" />
          Entrar con Google
        </button>
        <p className="text-[0.9375rem] text-muted">
          Usás tu cuenta de Google y no hace falta crear una contraseña nueva.
        </p>

        <div className="flex flex-col gap-3 text-sm text-muted">
          <p>Google comparte los datos básicos de tu cuenta para identificarte. No pedimos acceso a tu calendario.</p>
          <LegalLinks />
        </div>
        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
            <WarningCircle weight="bold" className="mt-0.5 size-5 flex-none" aria-hidden="true" />
            {error}
          </p>
        ) : null}

      </div>
    </div>
  )
}
