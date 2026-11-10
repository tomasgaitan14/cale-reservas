import { Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { cancelAppointment, deleteTimeBlock } from '../../lib/agenda-api.ts'
import { minutesToTime, type AgendaItem } from '../../lib/agenda.ts'
import { formatLongDate } from '../../lib/dates.ts'
import { SECONDARY_BUTTON } from '../ui.ts'

interface ItemDetailProps {
  item: AgendaItem
  date: string
  onChanged: () => void
  onClose: () => void
}

export function ItemDetail({ item, date, onChanged, onClose }: ItemDetailProps) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isBlock = item.kind === 'block'

  async function remove() {
    setBusy(true)
    setError(null)
    const result = isBlock ? await deleteTimeBlock(item.id) : await cancelAppointment(item.id)
    setBusy(false)
    if (result.ok) onChanged()
    else setError(result.errors.general ?? 'No pudimos hacer el cambio. Probá de nuevo.')
  }

  return (
    <div className="flex flex-col gap-5">
      <dl className="flex flex-col gap-3 rounded-[1.25rem] bg-ink p-5 text-on-ink">
        <Row label="Día" value={formatLongDate(date)} />
        <Row label="Horario" value={`${minutesToTime(item.startMinutes)} a ${minutesToTime(item.endMinutes)}`} />
        {item.kind === 'appointment' ? (
          <>
            <Row label="Cliente" value={item.clientName} />
            <Row label="Servicio" value={item.serviceName} />
            <Row label="Profesional" value={item.professionalName} />
            <Row label="Celular" value={item.clientPhone ? `+${item.clientPhone}` : 'No dejó celular'} />
            <Row label="Cómo se cargó" value={item.source === 'manual' ? 'A mano, por el negocio' : 'Desde la página de reservas'} />
          </>
        ) : (
          <Row label="Motivo" value={item.reason ?? 'Sin motivo'} />
        )}
      </dl>

      {error ? (
        <p role="alert" className="rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {confirming ? (
          <>
            <span className="text-base font-medium">{isBlock ? '¿Quitar este bloqueo?' : '¿Cancelar este turno?'}</span>
            <button type="button" className={SECONDARY_BUTTON} onClick={() => void remove()} disabled={busy}>
              {isBlock ? 'Sí, quitar' : 'Sí, cancelar'}
            </button>
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setConfirming(false)} disabled={busy}>
              No
            </button>
          </>
        ) : (
          <>
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setConfirming(true)}>
              <Trash weight="bold" className="size-5" aria-hidden="true" />
              {isBlock ? 'Quitar bloqueo' : 'Cancelar turno'}
            </button>
            <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[0.9375rem] text-ink-muted">{label}</dt>
      <dd className="break-words font-head text-lg font-extrabold tracking-tight">{value}</dd>
    </div>
  )
}
