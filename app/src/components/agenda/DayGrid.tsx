import type { CSSProperties } from 'react'
import {
  hourLines,
  minutesFromOffset,
  minutesToTime,
  timeToMinutes,
  type AgendaItem,
  type MinuteRange,
} from '../../lib/agenda.ts'
import { dayOfMonth, weekdayName, weekdayOf } from '../../lib/dates.ts'
import type { WeekHours } from '../../lib/hours.ts'

// Alto de una hora en la grilla: alcanza para que un turno de una hora muestre dos líneas de texto
const HOUR_HEIGHT_PX = 64
const MINUTES_PER_HOUR = 60
const GUTTER_WIDTH = '3.5rem'
const WEEKDAY_SHORT_LENGTH = 3
// Un turno muy corto igual tiene que poder tocarse
const MIN_ITEM_HEIGHT_PX = 24
// Por debajo de este alto el turno muestra una sola línea
const TWO_LINES_MIN_HEIGHT_PX = 44

interface DayGridProps {
  dates: string[]
  today: string
  itemsByDate: Record<string, AgendaItem[]>
  hours: WeekHours
  range: MinuteRange
  onEmptyClick: (date: string, minutes: number) => void
  onItemClick: (item: AgendaItem) => void
}

const pixelsFor = (minutes: number): number => (minutes / MINUTES_PER_HOUR) * HOUR_HEIGHT_PX

export function DayGrid({ dates, today, itemsByDate, hours, range, onEmptyClick, onItemClick }: DayGridProps) {
  const height = pixelsFor(range.end - range.start)
  const lines = hourLines(range)
  const columns: CSSProperties = { gridTemplateColumns: `${GUTTER_WIDTH} repeat(${dates.length}, minmax(0, 1fr))` }
  // En la semana, cada día necesita un ancho mínimo para que se lea el texto: la grilla se desliza hacia el costado
  const minWidth = dates.length > 1 ? `${3.5 + dates.length * 7}rem` : undefined

  return (
    <div className="overflow-x-auto rounded-[1.5rem] bg-surface shadow-soft">
      <div style={{ minWidth }}>
        <div className="grid border-b-2 border-line" style={columns}>
          <div />
          {dates.map(date => (
            <div key={date} className="flex flex-col items-center py-3">
              <span className="text-[0.9375rem] font-bold capitalize text-muted">{weekdayName(date).slice(0, WEEKDAY_SHORT_LENGTH)}</span>
              <span
                className={`grid size-9 place-items-center rounded-full font-head text-lg font-extrabold tracking-tight ${
                  date === today ? 'bg-ink text-on-ink' : ''
                }`}
              >
                {dayOfMonth(date)}
              </span>
            </div>
          ))}
        </div>

        <div className="grid" style={columns}>
          <div className="relative" style={{ height }} aria-hidden="true">
            {lines.slice(0, -1).map(line => (
              <span
                key={line}
                className="absolute right-2 -translate-y-1/2 text-[0.9375rem] text-muted"
                style={{ top: pixelsFor(line - range.start) + (line === range.start ? 8 : 0) }}
              >
                {minutesToTime(line)}
              </span>
            ))}
          </div>

          {dates.map(date => (
            <div
              key={date}
              role="presentation"
              className="relative cursor-pointer border-l-2 border-line bg-line/40"
              style={{ height }}
              onClick={event => {
                const rect = event.currentTarget.getBoundingClientRect()
                onEmptyClick(date, minutesFromOffset(event.clientY - rect.top, HOUR_HEIGHT_PX, range.start))
              }}
            >
              {(hours[weekdayOf(date)] ?? []).map(span => (
                <div
                  key={`${span.start}-${span.end}`}
                  className="absolute inset-x-0 bg-surface"
                  style={{
                    top: pixelsFor(timeToMinutes(span.start) - range.start),
                    height: pixelsFor(timeToMinutes(span.end) - timeToMinutes(span.start)),
                  }}
                />
              ))}
              {lines.map(line => (
                <div key={line} className="absolute inset-x-0 border-t-2 border-line" style={{ top: pixelsFor(line - range.start) }} />
              ))}
              {(itemsByDate[date] ?? []).map(item => (
                <AgendaItemButton key={`${item.kind}-${item.id}`} item={item} range={range} onClick={() => onItemClick(item)} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AgendaItemButton({ item, range, onClick }: { item: AgendaItem; range: MinuteRange; onClick: () => void }) {
  const start = Math.max(item.startMinutes, range.start)
  const end = Math.min(item.endMinutes, range.end)
  const top = pixelsFor(start - range.start)
  const height = Math.max(pixelsFor(end - start), MIN_ITEM_HEIGHT_PX)
  const twoLines = height >= TWO_LINES_MIN_HEIGHT_PX
  const time = `${minutesToTime(item.startMinutes)} a ${minutesToTime(item.endMinutes)}`

  if (item.kind === 'block') {
    return (
      <button
        type="button"
        onClick={event => {
          event.stopPropagation()
          onClick()
        }}
        aria-label={`Bloqueado de ${time}${item.reason ? `: ${item.reason}` : ''}`}
        className="absolute inset-x-1 overflow-hidden rounded-[10px] border-2 border-field-line bg-[repeating-linear-gradient(135deg,var(--border),var(--border)_6px,var(--surface)_6px,var(--surface)_12px)] px-2 py-0.5 text-left text-[0.9375rem] font-bold text-muted transition duration-200 hover:border-ink"
        style={{ top, height }}
      >
        <span className="block truncate">{item.reason ?? 'Bloqueado'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={event => {
        event.stopPropagation()
        onClick()
      }}
      aria-label={`Turno de ${time}: ${item.clientName}, ${item.serviceName}`}
      className={`absolute inset-x-1 overflow-hidden rounded-[10px] border-l-4 bg-tint px-2 py-0.5 text-left text-[0.9375rem] leading-tight transition duration-200 hover:brightness-95 active:scale-[0.99] ${
        item.source === 'manual' ? 'border-ink' : 'border-ok'
      }`}
      style={{ top, height }}
    >
      <span className="block truncate font-bold">
        {minutesToTime(item.startMinutes)} {item.clientName}
      </span>
      {twoLines ? <span className="block truncate text-muted">{item.serviceName}</span> : null}
    </button>
  )
}
