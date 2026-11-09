// Marca de Cale: doble tilde sobre ficha negra. Mismo dibujo que cale-web (src/lib/brand.ts, fuente única de la marca).
const MARK_SIZE = 64
const MARK_RADIUS = 18
const MARK_STROKE = 6.5
const FADED_TICK_OPACITY = 0.45

export function Brand() {
  return (
    <a href="https://cale.com.ar" aria-label="Cale" className="cale-brand inline-flex items-center gap-[0.5625rem] font-head text-2xl font-extrabold leading-none tracking-[-0.05em] text-fg no-underline">
      <svg className="block size-[2.125rem] flex-none" viewBox={`0 0 ${MARK_SIZE} ${MARK_SIZE}`} aria-hidden="true" focusable="false">
        <rect width={MARK_SIZE} height={MARK_SIZE} rx={MARK_RADIUS} fill="var(--ink)" />
        <g fill="none" stroke="var(--accent)" strokeWidth={MARK_STROKE} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 33L21 43L40 21.5" strokeOpacity={FADED_TICK_OPACITY} />
          <path d="M24 33L34 43L53 21.5" />
        </g>
      </svg>
      cale
    </a>
  )
}
