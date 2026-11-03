import { GoogleLogo, WarningCircle } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { TextField } from '../components/TextField.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'
import { supabase } from '../lib/supabase.ts'

const GOOGLE_UNAVAILABLE = 'El ingreso con Google todavía no está activado. Mientras tanto, en tu computadora podés probar con el correo de abajo.'
const GENERIC_ERROR = 'No pudimos entrar. Probá de nuevo en un momento.'
// Mínimo que exige Supabase Auth en local
const MIN_PASSWORD_LENGTH = 6

export function LoginScreen() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function signInWithGoogle() {
    setBusy(true)
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (oauthError) {
      setError(import.meta.env.DEV ? GOOGLE_UNAVAILABLE : GENERIC_ERROR)
      setBusy(false)
    }
  }

  return (
    <div className="grid items-start gap-10 md:grid-cols-[1.15fr_0.85fr] md:gap-16">
      <div className="rise-in flex flex-col gap-5 pt-2 md:pt-10" style={{ '--i': 0 } as React.CSSProperties}>
        <h1 className="text-[1.875rem] md:text-[2.75rem] md:leading-[1.05]">
          Entrá a tu panel <span className="text-muted">de Cale.</span>
        </h1>
        <p className="max-w-[34ch] text-[1.1875rem] text-muted">
          Desde acá vas a cargar tus servicios y tus horarios, y a elegir cuándo les avisamos a tus clientes por WhatsApp.
        </p>
      </div>

      <div
        className="rise-in flex flex-col gap-6 rounded-[2rem] bg-surface p-6 shadow-soft md:p-8"
        style={{ '--i': 1 } as React.CSSProperties}
      >
        <button type="button" className={PRIMARY_BUTTON} onClick={signInWithGoogle} disabled={busy}>
          <GoogleLogo weight="bold" className="size-6" aria-hidden="true" />
          Entrar con Google
        </button>
        <p className="text-[0.9375rem] text-muted">
          Usás tu cuenta de Google y no hace falta crear una contraseña nueva.
        </p>

        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
            <WarningCircle weight="bold" className="mt-0.5 size-5 flex-none" aria-hidden="true" />
            {error}
          </p>
        ) : null}

        {import.meta.env.DEV ? <DevLoginForm /> : null}
      </div>
    </div>
  )
}

// Solo existe en desarrollo (Vite lo saca del build de producción): sirve para probar sin tener Google configurado
function DevLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function authenticate(mode: 'sign-in' | 'sign-up') {
    setBusy(true)
    setError(null)
    const credentials = { email: email.trim(), password }
    const { error: authError } =
      mode === 'sign-in' ? await supabase.auth.signInWithPassword(credentials) : await supabase.auth.signUp(credentials)
    if (authError) setError(authError.message)
    setBusy(false)
  }

  return (
    <form
      className="flex flex-col gap-4 border-t-2 border-dashed border-line pt-6"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        void authenticate('sign-in')
      }}
    >
      <p className="font-head text-base font-extrabold tracking-tight">Solo para probar en tu computadora</p>
      <TextField
        id="dev-email"
        label="Correo"
        type="email"
        autoComplete="email"
        value={email}
        onChange={event => setEmail(event.target.value)}
        required
      />
      <TextField
        id="dev-password"
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        hint="Mínimo 6 caracteres."
        value={password}
        onChange={event => setPassword(event.target.value)}
        required
        minLength={MIN_PASSWORD_LENGTH}
        error={error}
      />
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={SECONDARY_BUTTON} disabled={busy}>
          Entrar
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
          disabled={busy || !email || password.length < MIN_PASSWORD_LENGTH}
          onClick={() => void authenticate('sign-up')}
        >
          Crear cuenta de prueba
        </button>
      </div>
    </form>
  )
}
