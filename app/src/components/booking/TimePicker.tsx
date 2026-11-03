import { CalendarX } from '@phosphor-icons/react'
import { SECONDARY_BUTTON } from '../ui.ts'

export type SlotsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; times: string[] }

interface TimePickerProps {
  slots: SlotsState
  selected: string | null
  onSelect: (time: string) => void
  onRetry: () => void
}

const SKELETON_COUNT = 8

export function TimePicker({ slots, selected, onSelect, onRetry }: TimePickerProps) {
  if (slots.status === 'loading') {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5" role="status" aria-label="Buscando horarios libres">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <div key={index} className="skeleton h-12 rounded-xl" />
        ))}
      </div>
    )
  }

  if (slots.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted">No pudimos buscar los horarios.</p>
        <button type="button" className={SECONDARY_BUTTON} onClick={onRetry}>
          Reintentar
        </button>
      </div>
    )
  }

  if (slots.times.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-[1.25rem] bg-tint p-5">
        <CalendarX weight="bold" className="mt-0.5 size-6 flex-none" aria-hidden="true" />
        <p className="text-base">No quedan horarios libres ese día. Probá con otro.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5" role="group" aria-label="Horarios libres">
      {slots.times.map(time => (
        <button
          key={time}
          type="button"
          aria-pressed={time === selected}
          onClick={() => onSelect(time)}
          className={`h-12 rounded-xl border-2 font-head text-base font-extrabold tracking-tight transition duration-200 active:scale-[0.97] ${
            time === selected ? 'border-ink bg-ink text-on-ink' : 'border-line bg-surface hover:border-field-line'
          }`}
        >
          {time}
        </button>
      ))}
    </div>
  )
}
