import { Check } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { createOwnerAppointment } from '../../lib/agenda-api.ts'
import type { AgendaFormErrors } from '../../lib/agenda-errors.ts'
import { INVALID_PHONE_MESSAGE } from '../../lib/booking-errors.ts'
import { todayInArgentina } from '../../lib/dates.ts'
import { formatDuration } from '../../lib/duration.ts'
import { normalizePhone } from '../../lib/phone.ts'
import type { Service } from '../../lib/services.ts'
import { SelectField } from '../SelectField.tsx'
import { TextField } from '../TextField.tsx'
import { TimeSelect } from '../TimeSelect.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../ui.ts'

const MAX_NAME_LENGTH = 80

interface AppointmentFormProps {
  businessId: string
  services: Service[]
  initialDate: string
  initialTime: string
  onSaved: () => void
  onCancel: () => void
}

// El negocio carga un turno que le pidieron por fuera de la página: por teléfono, por WhatsApp o en persona
export function AppointmentForm({ businessId, services, initialDate, initialTime, onSaved, onCancel }: AppointmentFormProps) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState(initialTime)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [reminders, setReminders] = useState(false)
  const [errors, setErrors] = useState<AgendaFormErrors>({})
  const [busy, setBusy] = useState(false)

  const hasPhone = phone.trim() !== ''

  function clear(field: keyof AgendaFormErrors) {
    setErrors(current => ({ ...current, [field]: undefined }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = hasPhone ? normalizePhone(phone) : null
    if (hasPhone && !normalized) {
      setErrors({ phone: INVALID_PHONE_MESSAGE })
      return
    }

    setBusy(true)
    setErrors({})
    const result = await createOwnerAppointment(businessId, {
      serviceId,
      date,
      time,
      name: name.trim(),
      phone: normalized,
      reminders: reminders && normalized !== null,
    })
    setBusy(false)
    if (result.ok) onSaved()
    else setErrors(result.errors)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <SelectField
        id="appointment-service"
        label="Servicio"
        options={services.map(service => ({
          value: service.id,
          label: `${service.name} · ${formatDuration(service.duration_minutes)}${service.active ? '' : ' (pausado)'}`,
        }))}
        value={serviceId}
        onChange={event => {
          setServiceId(event.target.value)
          clear('service')
        }}
        error={errors.service}
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[11rem] flex-1">
            <TextField
              id="appointment-date"
              label="Día"
              type="date"
              min={todayInArgentina()}
              value={date}
              onChange={event => {
                setDate(event.target.value)
                clear('time')
              }}
              required
            />
          </div>
          <TimeSelect
            id="appointment-time"
            label="Hora"
            role="start"
            value={time}
            invalid={Boolean(errors.time)}
            onChange={value => {
              setTime(value)
              clear('time')
            }}
          />
        </div>
        {errors.time ? (
          <p role="alert" className="text-[0.9375rem] font-medium text-warn">
            {errors.time}
          </p>
        ) : null}
      </div>

      <TextField
        id="appointment-name"
        label="Nombre del cliente"
        autoComplete="off"
        maxLength={MAX_NAME_LENGTH}
        value={name}
        onChange={event => {
          setName(event.target.value)
          clear('name')
        }}
        error={errors.name}
        required
      />
      <TextField
        id="appointment-phone"
        label="Celular (si lo tenés)"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="3445 55-0142"
        hint="Con el código de área, sin el 15."
        value={phone}
        onChange={event => {
          setPhone(event.target.value)
          clear('phone')
        }}
        error={errors.phone}
      />

      <label className={`flex items-start gap-3 text-base ${hasPhone ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
        <input
          type="checkbox"
          className="peer sr-only"
          checked={reminders && hasPhone}
          disabled={!hasPhone}
          onChange={event => setReminders(event.target.checked)}
        />
        <span
          className="mt-0.5 grid size-6 flex-none place-items-center rounded-md border-2 border-field-line bg-surface text-on-ink transition-colors peer-checked:border-ink peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-link"
          aria-hidden="true"
        >
          {reminders && hasPhone ? <Check weight="bold" className="size-4" /> : null}
        </span>
        <span>El cliente aceptó recibir recordatorios de este turno por WhatsApp.</span>
      </label>

      {errors.general ? (
        <p role="alert" className="rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
          {errors.general}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={`${PRIMARY_BUTTON} sm:w-auto sm:flex-1`} disabled={busy || !serviceId}>
          {busy ? 'Guardando…' : 'Cargar turno'}
        </button>
        <button type="button" className={SECONDARY_BUTTON} onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
