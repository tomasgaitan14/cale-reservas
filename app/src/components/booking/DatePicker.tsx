import { dayOfMonth, monthName, weekdayName } from '../../lib/dates.ts'

interface DatePickerProps {
  dates: string[]
  selected: string | null
  onSelect: (date: string) => void
}

const SHORT_LENGTH = 3

// Fila de días que se desliza hacia el costado: cada botón dice día de la semana, número y mes
export function DatePicker({ dates, selected, onSelect }: DatePickerProps) {
  return (
    <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0" role="group" aria-label="Días disponibles">
      {dates.map(date => {
        const active = date === selected
        return (
          <button
            key={date}
            type="button"
            aria-pressed={active}
            aria-label={`${weekdayName(date)} ${dayOfMonth(date)} de ${monthName(date)}`}
            onClick={() => onSelect(date)}
            className={`flex h-24 w-[4.5rem] flex-none snap-start flex-col items-center justify-center gap-0.5 rounded-[1.25rem] border-2 transition duration-200 active:scale-[0.97] ${
              active ? 'border-ink bg-ink text-on-ink' : 'border-line bg-surface hover:border-field-line'
            }`}
          >
            <span className={`text-[0.9375rem] font-bold capitalize ${active ? 'text-ink-muted' : 'text-muted'}`}>
              {weekdayName(date).slice(0, SHORT_LENGTH)}
            </span>
            <span className="font-head text-2xl font-extrabold leading-none tracking-tight">{dayOfMonth(date)}</span>
            <span className={`text-[0.9375rem] ${active ? 'text-ink-muted' : 'text-muted'}`}>{monthName(date).slice(0, SHORT_LENGTH)}</span>
          </button>
        )
      })}
    </div>
  )
}
