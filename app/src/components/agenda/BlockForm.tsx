import { Check } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { createTimeBlock } from '../../lib/agenda-api.ts'
import type { AgendaFormErrors } from '../../lib/agenda-errors.ts'
import { minutesToTime, timeToMinutes } from '../../lib/agenda.ts'
import { todayInArgentina } from '../../lib/dates.ts'
import { TextField } from '../TextField.tsx'
import { TimeSelect } from '../TimeSelect.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../ui.ts'

const MAX_REASON_LENGTH = 80
const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR
const DAY_START = '00:00'
const DAY_END = '24:00'

interface BlockFormProps {
  businessId: string
  initialDate: string
  initialTime: string
  onSaved: () => void
  onCancel: () => void
}

// Por defecto el bloqueo dura una hora desde la que se tocó, sin pasar de las 24:00
function defaultEnd(startTime: string): string {
  return minutesToTime(Math.min(timeToMinutes(startTime) + MINUTES_PER_HOUR, MINUTES_PER_DAY))
}

export function BlockForm({ businessId, initialDate, initialTime, onSaved, onCancel }: BlockFormProps) {
  const [startDate, setStartDate] = useState(initialDate)
  const [startTime, setStartTime] = useState(initialTime)
  const [endDate, setEndDate] = useState(initialDate)
  const [endTime, setEndTime] = useState(defaultEnd(initialTime))
  const [allDay, setAllDay] = useState(false)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<AgendaFormErrors>({})
  const [busy, setBusy] = useState(false)

  function clear(field: keyof AgendaFormErrors) {
    setErrors(current => ({ ...current, [field]: undefined }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    const result = await createTimeBlock(businessId, {
      startDate,
      startTime: allDay ? DAY_START : startTime,
      endDate,
      endTime: allDay ? DAY_END : endTime,
      reason,
    })
    setBusy(false)
    if (result.ok) onSaved()
    else setErrors(result.errors)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[11rem] flex-1">
          <TextField
            id="block-start-date"
            label="Desde el día"
            type="date"
            min={todayInArgentina()}
            value={startDate}
            onChange={event => {
              setStartDate(event.target.value)
              // Si el bloqueo era de un solo día, sigue siéndolo al cambiar la fecha de inicio
              if (endDate === startDate || event.target.value > endDate) setEndDate(event.target.value)
              clear('time')
            }}
            required
          />
        </div>
        {allDay ? null : (
          <TimeSelect
            id="block-start-time"
            label="Hora"
            role="start"
            value={startTime}
            invalid={Boolean(errors.time)}
            onChange={value => {
              setStartTime(value)
              clear('time')
            }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[11rem] flex-1">
          <TextField
            id="block-end-date"
            label="Hasta el día"
            type="date"
            min={startDate}
            value={endDate}
            onChange={event => {
              setEndDate(event.target.value)
              clear('time')
            }}
            required
          />
        </div>
        {allDay ? null : (
          <TimeSelect
            id="block-end-time"
            label="Hora"
            role="end"
            value={endTime}
            invalid={Boolean(errors.time)}
            onChange={value => {
              setEndTime(value)
              clear('time')
            }}
          />
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-base">
        <input type="checkbox" className="peer sr-only" checked={allDay} onChange={event => setAllDay(event.target.checked)} />
        <span
          className="mt-0.5 grid size-6 flex-none place-items-center rounded-md border-2 border-field-line bg-surface text-on-ink transition-colors peer-checked:border-ink peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-link"
          aria-hidden="true"
        >
          {allDay ? <Check weight="bold" className="size-4" /> : null}
        </span>
        <span>Todo el día (desde las 00:00 del primer día hasta las 24:00 del último)</span>
      </label>

      {errors.time ? (
        <p role="alert" className="text-[0.9375rem] font-medium text-warn">
          {errors.time}
        </p>
      ) : null}

      <TextField
        id="block-reason"
        label="Motivo (opcional)"
        placeholder="Vacaciones, trámite…"
        maxLength={MAX_REASON_LENGTH}
        value={reason}
        onChange={event => {
          setReason(event.target.value)
          clear('reason')
        }}
        error={errors.reason}
      />

      {errors.general ? (
        <p role="alert" className="rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
          {errors.general}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={`${PRIMARY_BUTTON} sm:w-auto sm:flex-1`} disabled={busy}>
          {busy ? 'Guardando…' : 'Bloquear horario'}
        </button>
        <button type="button" className={SECONDARY_BUTTON} onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
