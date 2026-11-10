import { signOutWithPush } from './lib/push.ts'
import { usePanelPwa } from './hooks/usePanelPwa.ts'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Shell } from './components/Shell.tsx'
import { SECONDARY_BUTTON } from './components/ui.ts'
import { useSession } from './hooks/useSession.ts'
import { BusinessLoadError, claimPendingInvitations, fetchMyBusiness, TeamLoadError, type Business } from './lib/business.ts'
import { isSubscriptionReturn, PRO_CHECKOUT_ENABLED, syncProSubscription } from './lib/billing.ts'
import { parseRoute } from './lib/route.ts'
import { designVariant } from './designs/model.ts'
import { supabase } from './lib/supabase.ts'
import { BookingPage } from './screens/BookingPage.tsx'
import { CreateBusinessScreen } from './screens/CreateBusinessScreen.tsx'
import { LoginScreen } from './screens/LoginScreen.tsx'
const DesignPreview = import.meta.env.DEV ? lazy(() => import('./designs/DesignPreview.tsx').then(module => ({ default: module.DesignPreview }))) : null
const LandingScreen = lazy(() => import('./screens/LandingScreen.tsx').then(module => ({ default: module.LandingScreen })))
const Panel = lazy(() => import('./screens/Panel.tsx').then(module => ({ default: module.Panel })))
const BILLING_SYNC_TIMEOUT_MS = 2 * 60 * 1000
const BILLING_SYNC_INTERVAL_MS = 3000

type BusinessState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; business: Business | null }

function BusinessGate() {
  const [state, setState] = useState<BusinessState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function loadBusiness() {
      setState({ status: 'loading' })
      try {
        await claimPendingInvitations()
        const business = await fetchMyBusiness()
        const returnedFromSubscription = isSubscriptionReturn(window.location.search)
        const waitingForPayment = business && business.plan !== 'pro' && (returnedFromSubscription || business.billing_status === 'pending')
        if (!cancelled) setState({ status: 'ready', business })
        if (business && waitingForPayment) {
          void (async () => {
            await syncProSubscription(business.id).catch(() => undefined)
            const startedAt = Date.now()
            let currentBusiness: Business | null = business
            while (currentBusiness && currentBusiness.plan !== 'pro' && currentBusiness.billing_status === 'pending' && Date.now() - startedAt < BILLING_SYNC_TIMEOUT_MS) {
              await new Promise(resolve => window.setTimeout(resolve, BILLING_SYNC_INTERVAL_MS))
              currentBusiness = await fetchMyBusiness()
              if (!cancelled && currentBusiness?.plan === 'pro') setState({ status: 'ready', business: currentBusiness })
            }
            if (returnedFromSubscription && !cancelled) window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
          })()
        }
      } catch (error: unknown) {
        if (!(error instanceof BusinessLoadError || error instanceof TeamLoadError)) throw error
        if (!cancelled) setState({ status: 'error' })
      }
    }
    void loadBusiness()
    return () => {
      cancelled = true
    }
  }, [attempt])

  if (state.status === 'ready' && state.business) {
    return <Suspense fallback={<Shell><LoadingPanel /></Shell>}><Panel business={state.business} /></Suspense>
  }
  return <Shell onSignOut={() => { void signOutWithPush().then(({ error }) => { if (error) window.alert(error.message) }) }}>
    {state.status === 'loading' ? <LoadingPanel /> : state.status === 'error' ? <div className="flex max-w-md flex-col items-start gap-4 pt-10">
      <h1 className="text-[1.875rem]">No pudimos cargar tu panel</h1>
      <p className="text-muted">Revisá tu conexión y probá de nuevo.</p>
      <button type="button" className={SECONDARY_BUTTON} onClick={() => setAttempt(count => count + 1)}>Reintentar</button>
    </div> : <CreateBusinessScreen onCreated={business => setState({ status: 'ready', business })} />}
  </Shell>
}

// Esqueleto con la forma de la pantalla que viene, en vez de un spinner
function LoadingPanel({ message }: { message?: string }) {
  return (
    <div className="grid gap-10 pt-6 md:grid-cols-[1.1fr_0.9fr] md:gap-16 md:pt-12" role="status" aria-label="Cargando tu panel">
      <div className="flex flex-col gap-4">
        <div className="skeleton h-5 w-24 rounded-md" />
        <div className="skeleton h-14 w-3/4 rounded-xl" />
        <div className="skeleton h-28 w-full rounded-[1.25rem]" />
        {message && <p className="max-w-md text-lg font-semibold text-ink">{message}</p>}
      </div>
      <div className="flex flex-col gap-4">
        <div className="skeleton h-20 w-full rounded-xl" />
        <div className="skeleton h-20 w-full rounded-xl" />
        <div className="skeleton h-20 w-full rounded-xl" />
      </div>
    </div>
  )
}

function PanelApp() {
  const session = useSession()

  if (session.status === 'loading') {
    return (
      <Shell>
        <LoadingPanel />
      </Shell>
    )
  }

  if (session.status === 'signed-out') {
    return (
      <Shell>
        <LoginScreen />
      </Shell>
    )
  }

  return <BusinessGate />
}

function NotFound() {
  return (
    <Shell>
      <div className="flex max-w-md flex-col items-start gap-4 pt-10">
        <h1 className="text-[1.875rem]">No encontramos esta página</h1>
        <p className="text-muted">Revisá que el link esté bien escrito.</p>
      </div>
    </Shell>
  )
}

// cale.com.ar/panel es el panel del negocio; cale.com.ar/<negocio> es su página de reservas
export function App() {
  usePanelPwa()
  const currentUrl = new URL(window.location.href)
  if (!PRO_CHECKOUT_ENABLED && currentUrl.pathname === '/empezar' && currentUrl.searchParams.get('plan') === 'pro') {
    currentUrl.searchParams.delete('plan')
    window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
  }
  const variant = import.meta.env.DEV ? designVariant(window.location.pathname) : null
  if (variant && DesignPreview) return <Suspense fallback={<Shell><LoadingPanel /></Shell>}><DesignPreview key={variant} variant={variant} /></Suspense>
  const route = parseRoute(window.location.pathname)
  if (route.kind === 'landing') return <Suspense fallback={<Shell><LoadingPanel /></Shell>}><LandingScreen /></Suspense>
  if (route.kind === 'booking') return <BookingPage slug={route.slug} />
  if (route.kind === 'not-found') return <NotFound />
  return <PanelApp />
}
