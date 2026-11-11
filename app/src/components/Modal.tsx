import { X } from '@phosphor-icons/react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

// Ventana con el elemento <dialog> nativo: el navegador se ocupa de dejar el resto de la página inerte, mover el foco y cerrar con Escape
export function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      // Un clic en el fondo oscuro llega al propio <dialog>, no a su contenido
      onClick={event => {
        if (event.target === dialogRef.current) onClose()
      }}
      className="panel-dialog m-auto max-h-[90dvh] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-[1.75rem] bg-bg p-0 text-fg shadow-soft backdrop:bg-ink/50"
    >
      <div className="dialog-body flex flex-col gap-5 p-6 md:p-8">
        <div className="dialog-heading flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-[1.5rem]">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="grid size-11 flex-none place-items-center rounded-[12px] border-2 border-ink transition duration-200 hover:bg-ink hover:text-on-ink active:scale-[0.98]"
          >
            <X weight="bold" className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
