import { CaretDown } from '@phosphor-icons/react'
import { timeOptions } from '../lib/hours.ts'

interface TimeSelectProps {
  id: string
  label: string
  role: 'start' | 'end'
  value: string
  invalid?: boolean
  onChange: (value: string) => void
}

// Lista de horas en formato de 24 h, de a 15 minutos: se ve igual en cualquier navegador, a diferencia del selector de hora nativo
export function TimeSelect({ id, label, role, value, invalid = false, onChange }: TimeSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[0.9375rem] font-bold text-muted">
        {label}
      </label>
      <div
        className={`relative flex w-32 items-center rounded-[12px] border-2 bg-surface transition-colors focus-within:border-ink ${
          invalid ? 'border-warn' : 'border-field-line'
        }`}
      >
        <select
          id={id}
          className="h-[3.375rem] w-full min-w-0 cursor-pointer appearance-none bg-transparent pl-4 pr-9 text-base text-fg focus:outline-none"
          value={value}
          aria-invalid={invalid ? true : undefined}
          onChange={event => onChange(event.target.value)}
        >
          {timeOptions(role, value).map(time => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
        <CaretDown weight="bold" className="pointer-events-none absolute right-3 size-4 text-muted" aria-hidden="true" />
      </div>
    </div>
  )
}
