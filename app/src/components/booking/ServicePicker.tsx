import { Clock } from '@phosphor-icons/react'
import type { PublicService } from '../../lib/booking-api.ts'
import { formatDuration } from '../../lib/duration.ts'

interface ServicePickerProps {
  services: PublicService[]
  selectedId: string | null
  onSelect: (serviceId: string) => void
}

export function ServicePicker({ services, selectedId, onSelect }: ServicePickerProps) {
  return (
    <div className="flex flex-col gap-3">
      {services.map(service => {
        const selected = service.id === selectedId
        return (
          <button
            key={service.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(service.id)}
            className={`flex items-center justify-between gap-4 rounded-[1.25rem] border-2 bg-surface px-5 py-4 text-left transition duration-200 active:scale-[0.99] ${
              selected ? 'border-ink shadow-soft' : 'border-line hover:border-field-line'
            }`}
          >
            <span className="break-words font-head text-lg font-extrabold tracking-tight">{service.name}</span>
            <span className="flex flex-none items-center gap-1.5 text-base text-muted">
              <Clock weight="bold" className="size-4" aria-hidden="true" />
              {formatDuration(service.duration_minutes)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
