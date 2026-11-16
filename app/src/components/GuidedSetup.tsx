import { useEffect, useState } from 'react'
import type { Business } from '../lib/business.ts'
import type { SetupProgress } from '../lib/setup.ts'
import { supabase } from '../lib/supabase.ts'
import { ServicesScreen } from '../screens/ServicesScreen.tsx'
import { HoursScreen } from '../screens/HoursScreen.tsx'
import { BusinessBranding } from './BusinessBranding.tsx'
import { ShareBooking } from './ShareBooking.tsx'
import { Modal } from './Modal.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './ui.ts'

const STEPS = [
  { title: '¡Bienvenido a Cale!', text: 'Vamos a dejar tu agenda lista, de a una cosa por vez. Podés pausar y continuar después.', action: 'Empezar' },
  { title: 'Creemos tu primer servicio', text: 'Cargá solo uno para probar: su nombre y cuánto dura. Después vas a poder agregar todos los demás desde Ajustes.', action: 'Crear mi servicio' },
  { title: 'Elegí cuándo atendés', text: 'Marcá tus días y horarios de atención. Podés ajustarlos después desde Ajustes → Tus horarios.', action: 'Configurar horarios' },
  { title: 'Dale tu identidad', text: 'Podés subir el logo y elegir los colores de tu negocio. Guardá el diseño antes de continuar, o dejalo para después.', action: 'Personalizar mi página' },
  { title: 'Tu página de reservas', text: 'Este es el link que compartís con tus clientes. Abrilo para conocer la página o copialo para enviarlo.', action: 'Ver mi link' },
  { title: 'Esta es tu agenda', text: 'Acá van a aparecer tus reservas. Con Nuevo turno podés cargar uno manualmente. En Clientes encontrás tus contactos y en Ajustes administrás tus servicios, horarios y equipo.', action: 'Ir a mi agenda' },
] as const

export function GuidedSetup({ business, progress, onPause, onComplete, busy, error }: {
  business: Business; progress: SetupProgress; onPause: () => void; onComplete: () => Promise<void>; busy: boolean; error: string
}) {
  const [key, setKey] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    let active = true
    void supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return
      const storageKey = 'cale:guided-setup:v1:' + data.user.id + ':' + business.id
      try {
        const stored = Number(localStorage.getItem(storageKey) ?? 0)
        if (Number.isInteger(stored) && stored >= 0 && stored < STEPS.length) setStep(stored)
      } catch { /* El recorrido también funciona cuando el navegador bloquea almacenamiento. */ }
      setKey(storageKey)
    })
    return () => { active = false }
  }, [business.id])
  function advance(next: number) {
    setStep(next); setIntro(true)
    try { if (key) localStorage.setItem(key, String(next)) } catch { /* Progreso en memoria. */ }
    window.scrollTo(0, 0)
  }
  if (!key) return <p role="status">Preparando tu recorrido…</p>
  const current = STEPS[step]!
  return <section className="guided-setup">
    <header className="guided-setup-progress">
      <div><p className="eyebrow">Primeros pasos</p><p className="mt-2 font-semibold">Paso {step + 1} de {STEPS.length}</p></div>
      <button type="button" className={SECONDARY_BUTTON} onClick={onPause} disabled={busy}>Seguir después</button>
    </header>
    <progress className="guided-setup-meter" aria-label="Progreso de configuración" value={step} max={STEPS.length - 1} />
    {error && <p role="alert" className="text-warn">{error}</p>}
    {!intro && step > 0 && <aside className="guided-setup-hint" role="status"><strong>{current.title}</strong><p>{current.text}</p></aside>}
    {step === 1 && <div className="guided-setup-target">
      {progress.serviceCount > 0 ? <div className="flex flex-col items-start gap-4"><h2>Ya tenés un servicio creado.</h2><p>Podés sumar más desde Ajustes cuando quieras.</p><button className={PRIMARY_BUTTON} onClick={() => advance(2)}>Continuar con mis horarios</button></div> : <ServicesScreen business={business} onBack={onPause} onContinue={() => advance(2)} />}
    </div>}
    {step === 2 && <div className="guided-setup-target"><HoursScreen business={business} onBack={onPause} onContinue={() => advance(business.role === 'professional' ? 5 : 3)} /></div>}
    {step === 3 && <div className="flex flex-col gap-6"><BusinessBranding businessId={business.id} name={business.name} onSaved={() => advance(4)} /><button className={SECONDARY_BUTTON} onClick={() => advance(4)}>Hacerlo después</button></div>}
    {step === 4 && <div className="flex flex-col items-start gap-6"><ShareBooking business={business} /><button className={PRIMARY_BUTTON} onClick={() => advance(5)}>Conocer mi agenda</button></div>}
    {step === 5 && !intro && <button className={PRIMARY_BUTTON} disabled={busy} onClick={() => void onComplete()}>{busy ? 'Guardando…' : 'Ir a mi agenda'}</button>}
    {intro && <Modal title={current.title} onClose={onPause}>
      <p className="text-sm font-semibold text-link">Paso {step + 1} de {STEPS.length}</p>
      <p className="text-muted">{current.text}</p>
      <div className="flex flex-wrap gap-3">
        <button className={PRIMARY_BUTTON} disabled={busy} onClick={() => { if (step === 0) advance(progress.serviceCount > 0 ? 2 : 1); else if (step === 5) void onComplete(); else setIntro(false) }}>{busy ? 'Guardando…' : current.action}</button>
        <button className={SECONDARY_BUTTON} disabled={busy} onClick={onPause}>Omitir tour por ahora</button>
      </div>
    </Modal>}
  </section>
}
