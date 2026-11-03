import { useEffect, useState } from 'react'
import type { Business } from '../lib/business.ts'
import { fetchSetupProgress, SetupLoadError, type SetupProgress } from '../lib/setup.ts'
import { AppointmentsScreen } from './AppointmentsScreen.tsx'
import { HoursScreen } from './HoursScreen.tsx'
import { PanelHome, type PanelView } from './PanelHome.tsx'
import { ServicesScreen } from './ServicesScreen.tsx'

// Pantallas del panel: sin rutas todavía, alcanza con recordar cuál se está viendo
export function Panel({ business }: { business: Business }) {
  const [view, setView] = useState<PanelView | 'home'>('home')
  const [progress, setProgress] = useState<SetupProgress | null>(null)

  // Al volver al inicio se vuelve a leer el avance, porque se pudo cargar algo en otra pantalla
  useEffect(() => {
    if (view !== 'home') return
    let cancelled = false
    fetchSetupProgress()
      .then(loaded => {
        if (!cancelled) setProgress(loaded)
      })
      .catch((error: unknown) => {
        if (!(error instanceof SetupLoadError)) throw error
        // Sin el avance, el inicio igual muestra los botones: queda como "cargando"
      })
    return () => {
      cancelled = true
    }
  }, [view])

  const goHome = () => setView('home')

  if (view === 'appointments') return <AppointmentsScreen onBack={goHome} />
  if (view === 'services') return <ServicesScreen business={business} onBack={goHome} />
  if (view === 'hours') return <HoursScreen business={business} onBack={goHome} />
  return <PanelHome business={business} progress={progress} onOpen={setView} />
}
