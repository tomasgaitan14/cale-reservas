import { WarningCircle } from '@phosphor-icons/react'
import type { InputHTMLAttributes } from 'react'
import { TEXT_INPUT } from './ui.ts'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className' | 'prefix'> {
  id: string
  label: string
  hint?: string
  preview?: string
  error?: string | null
  // Texto fijo antes de lo que escribe la persona (por ejemplo, "cale.com.ar/")
  prefix?: string
}

// Etiqueta arriba, ayuda opcional y el error debajo, como pide el diseño de formularios de Cale
export function TextField({ id, label, hint, error, prefix, preview, ...inputProps }: TextFieldProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, preview ? `${id}-preview` : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="form-field flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="font-head text-base font-extrabold tracking-tight">
        {label}
      </label>
      <div
        className={`flex items-center rounded-[12px] border-2 bg-surface transition-colors focus-within:border-ink ${
          error ? 'border-warn' : 'border-field-line'
        }`}
      >
        {prefix ? (
          <span className="select-none pl-4 text-base text-muted" aria-hidden="true">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          className={`${TEXT_INPUT} ${prefix ? 'pl-1' : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
      </div>
      {preview ? <p id={`${id}-preview`} className="break-all text-sm text-muted">Tu link: <span className="font-medium text-fg">{preview}</span></p> : null}
      {hint ? (
        <p id={hintId} className="text-[0.9375rem] text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[0.9375rem] font-medium text-warn">
          <WarningCircle weight="bold" className="mt-0.5 size-4 flex-none" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  )
}
