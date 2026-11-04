export function ReminderExample({ businessName }: { businessName: string }) {
  return <figure className="message-preview" aria-label="Ejemplo de recordatorio, no enviado">
    <figcaption className="mb-4 text-sm font-medium text-muted">Vista previa · datos de demostración</figcaption>
    <div className="rounded-2xl rounded-tl-sm bg-surface p-5"><p>Hola Cliente demo, te recordamos tu turno en {businessName} el jueves a las 17:30. ¿Nos confirmás si venís?</p></div>
    <div className="mt-2 grid grid-cols-2 gap-2" aria-label="Botones del mensaje de ejemplo">
      <span className="rounded-xl bg-surface p-3 text-center font-semibold text-link">Confirmo</span>
      <span className="rounded-xl bg-surface p-3 text-center font-semibold text-link">Cancelo</span>
    </div>
  </figure>
}
