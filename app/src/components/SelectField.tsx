import { CaretDown, WarningCircle } from '@phosphor-icons/react'
import type { SelectHTMLAttributes } from 'react'

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'> {
  id: string
  label: string
  error?: string | null
  options: readonly { value: string | number; label: string }[]
}

// Misma forma que TextField: etiqueta arriba y el error debajo
export function SelectField({ id, label, error, options, ...selectProps }: SelectFieldProps) {
  const errorId = `${id}-error`

  return (
    <div className="form-field flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="font-head text-base font-extrabold tracking-tight">
        {label}
      </label>
      <div
        className={`relative flex items-center rounded-[12px] border-2 bg-surface transition-colors focus-within:border-ink ${
          error ? 'border-warn' : 'border-field-line'
        }`}
      >
        <select
          id={id}
          className="h-[3.375rem] w-full min-w-0 cursor-pointer appearance-none bg-transparent pl-4 pr-11 text-base text-fg focus:outline-none"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...selectProps}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <CaretDown weight="bold" className="pointer-events-none absolute right-4 size-4 text-muted" aria-hidden="true" />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[0.9375rem] font-medium text-warn">
          <WarningCircle weight="bold" className="mt-0.5 size-4 flex-none" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  )
}
