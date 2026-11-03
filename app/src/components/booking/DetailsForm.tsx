import { Check, WarningCircle } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
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

interface DetailsFormProps {
  errors: BookingFormErrors
  busy: boolean
  onClearError: (field: keyof BookingFormErrors) => void
  onSubmit: (details: BookingDetails) => void
}

export function DetailsForm({ errors, busy, onClearError, onSubmit }: DetailsFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = normalizePhone(phone)
    if (!normalized) {
      setPhoneError(INVALID_PHONE_MESSAGE)
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
          setName(event.target.value)
          onClearError('name')
        }}
        error={errors.name}
        required
      />
      <TextField
        id="client-phone"
        label="Tu celular"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="3445 55-0142"
        hint="Con el código de área, sin el 15. Es para avisarte por WhatsApp."
        value={phone}
        onChange={event => {
          setPhone(event.target.value)
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
            className="peer sr-only"
            checked={consent}
            aria-describedby={errors.consent ? 'consent-error' : undefined}
            onChange={event => {
              setConsent(event.target.checked)
              onClearError('consent')
            }}
          />
          <span
            className={`mt-0.5 grid size-6 flex-none place-items-center rounded-md border-2 bg-surface text-on-ink transition-colors peer-checked:border-ink peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-link ${
              errors.consent ? 'border-warn' : 'border-field-line'
            }`}
            aria-hidden="true"
          >
            {consent ? <Check weight="bold" className="size-4" /> : null}
          </span>
          <span>Acepto que me manden por WhatsApp recordatorios de este turno.</span>
        </label>
        {errors.consent ? (
          <p id="consent-error" role="alert" className="flex items-start gap-1.5 text-[0.9375rem] font-medium text-warn">
            <WarningCircle weight="bold" className="mt-0.5 size-4 flex-none" aria-hidden="true" />
            {errors.consent}
          </p>
        ) : null}
      </div>

      {errors.general ? (
        <p role="alert" className="rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
          {errors.general}
        </p>
      ) : null}

      <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
        {busy ? 'Reservando…' : 'Reservar turno'}
      </button>
    </form>
  )
}
