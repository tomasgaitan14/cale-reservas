import { LegalLinks } from '../LegalLinks.tsx'
import { Check, WarningCircle } from '@phosphor-icons/react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { INVALID_PHONE_MESSAGE, type BookingFormErrors } from '../../lib/booking-errors.ts'
import { normalizePhone } from '../../lib/phone.ts'
import { TextField } from '../TextField.tsx'
import { PRIMARY_BUTTON } from '../ui.ts'

const MAX_NAME_LENGTH = 80

export interface BookingDetails {
  name: string
  // Ya normalizado: solo dígitos, con código de país
  phone: string
  consent: boolean
}

// Borrador en memoria: el celular conserva lo que la persona escribió hasta enviar.
export interface BookingDraft {
  name: string
  phone: string
  consent: boolean
}

interface DetailsFormProps {
  draft: BookingDraft
  onDraftChange: (draft: BookingDraft) => void
  errors: BookingFormErrors
  verification?: ReactNode
  verificationReady?: boolean
  busy: boolean
  onClearError: (field: keyof BookingFormErrors) => void
  onSubmit: (details: BookingDetails) => void
}

export function DetailsForm({ draft, onDraftChange, errors, busy, verification, verificationReady = true, onClearError, onSubmit }: DetailsFormProps) {
  const { name, phone, consent } = draft
  const [consentError, setConsentError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = normalizePhone(phone)
    const validName = name.trim().length > 0
    setNameError(validName ? null : 'Escribí tu nombre.')
    setPhoneError(normalized ? null : INVALID_PHONE_MESSAGE)
    setConsentError(consent ? null : 'Marcá la opción de recordatorios por WhatsApp para continuar.')
    if (!validName || !normalized || !consent) {
      const invalidId = !validName ? 'client-name' : !normalized ? 'client-phone' : 'client-consent'
      document.getElementById(invalidId)?.focus()
      return
    }
    onSubmit({ name: name.trim(), phone: normalized, consent })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField
        id="client-name"
        label="Tu nombre"
        autoComplete="name"
        maxLength={MAX_NAME_LENGTH}
        value={name}
        onChange={event => {
          onDraftChange({ ...draft, name: event.target.value })
          setNameError(null)
          onClearError('name')
        }}
        error={nameError ?? errors.name}
        required
      />
      <TextField
        id="client-phone"
        label="Tu celular"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="3445 55-0142"
        hint="Con el código de área, sin el 15. El negocio lo usa para contactarte por tu turno."
        value={phone}
        onChange={event => {
          onDraftChange({ ...draft, phone: event.target.value })
          setPhoneError(null)
          onClearError('phone')
        }}
        error={phoneError ?? errors.phone}
        required
      />

      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-start gap-3 text-base">
          <input
            type="checkbox"
            id="client-consent"
            aria-invalid={consentError || errors.consent ? true : undefined}
            className="peer sr-only"
            checked={consent}
            aria-describedby={consentError || errors.consent ? 'consent-error' : undefined}
            onChange={event => {
              onDraftChange({ ...draft, consent: event.target.checked })
              setConsentError(null)
              onClearError('consent')
            }}
          />
          <span
            className={`mt-0.5 grid size-6 flex-none place-items-center rounded-md border-2 bg-surface text-on-ink transition-colors peer-checked:border-ink peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-link ${
              consentError || errors.consent ? 'border-warn' : 'border-field-line'
            }`}
            aria-hidden="true"
          >
            {consent ? <Check weight="bold" className="size-4" /> : null}
          </span>
          <span>Acepto que me manden por WhatsApp recordatorios de este turno.</span>
        </label>
        {consentError || errors.consent ? (
          <p id="consent-error" role="alert" className="flex items-start gap-1.5 text-[0.9375rem] font-medium text-warn">
            <WarningCircle weight="bold" className="mt-0.5 size-4 flex-none" aria-hidden="true" />
            {consentError ?? errors.consent}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 text-sm text-muted">
        <p>El negocio recibe tu nombre, celular y los datos del turno para gestionar tu reserva. Los recordatorios por WhatsApp todavía no están habilitados. Para consultar o corregir tus datos, contactá al negocio o a <a className="underline" href="mailto:cale.turnos@gmail.com">Cale</a>.</p>
        <LegalLinks />
      </div>

      {errors.general ? (
        <p role="alert" className="rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
          {errors.general}
        </p>
      ) : null}

      {verification}
      <button type="submit" className={PRIMARY_BUTTON} disabled={busy || !verificationReady}>
        {busy ? 'Reservando…' : 'Reservar turno'}
      </button>
    </form>
  )
}
