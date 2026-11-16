// Los textos oficiales viven en el sitio público de Cale.
export function LegalLinks() {
  return <nav aria-label="Información legal" className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
    <a className="underline underline-offset-4" href="/privacidad" target="_blank" rel="noopener noreferrer">Privacidad</a>
    <a className="underline underline-offset-4" href="/terminos" target="_blank" rel="noopener noreferrer">Términos</a>
    <a className="underline underline-offset-4" href="/eliminar-datos" target="_blank" rel="noopener noreferrer">Eliminar mis datos</a>
  </nav>
}
