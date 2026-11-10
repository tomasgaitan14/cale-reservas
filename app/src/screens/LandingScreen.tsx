import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, Bell, CalendarBlank, Clock, QrCode, Storefront } from '@phosphor-icons/react'
import { ReminderExample } from '../components/ReminderExample.tsx'
import { BookingPreview } from '../components/BookingPreview.tsx'
import { Brand } from '../components/Brand.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'
import { useSession } from '../hooks/useSession.ts'
import { fetchPublicBusinesses, type PublicBusiness } from '../lib/business.ts'
import { logoUrl } from '../lib/branding-api.ts'
import { PricingSection } from './PricingScreen.tsx'

const FAQ = [
  ['¿Necesito otra agenda?', 'No. Cale tiene su propia agenda dentro del panel. Ahí ves las reservas, cargás turnos a mano y bloqueás horarios.'],
  ['¿Cómo reservan mis clientes?', 'Compartís el link de tu negocio o tu QR. Tus clientes eligen un servicio, un día y un horario disponible. El turno aparece en tu agenda.'],
  ['¿Puedo cargar turnos a mano y bloquear horarios?', 'Sí. Podés cargar los turnos que te pidan por fuera de la página y bloquear descansos, vacaciones o cualquier horario en el que no atiendas.'],
  ['¿Tengo que cambiar mi número de WhatsApp?', 'No. La conexión usa el número que ya usás en WhatsApp Business, para que puedas seguir viendo y respondiendo tus mensajes.'],
] as const
function TrustedBusinesses() {
  const [businesses, setBusinesses] = useState<PublicBusiness[] | null>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    fetchPublicBusinesses().then(value => { if (!cancelled) setBusinesses(value) }).catch(() => { if (!cancelled) setBusinesses([]) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!businesses?.length) return
    const measure = () => {
      const viewport = viewportRef.current
      const track = trackRef.current
      if (viewport && track) setIsOverflowing(track.scrollWidth > viewport.clientWidth + 1)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (observer && viewportRef.current) observer.observe(viewportRef.current)
    return () => observer?.disconnect()
  }, [businesses])
  if (businesses === null) return <section className="trusted-businesses-section" aria-label="Negocios que confían en Cale"><div className="trusted-businesses-heading"><p className="eyebrow">Cada vez somos más</p><h2>Ellos ya confían en nosotros.</h2></div><div className="trusted-businesses-loading" aria-hidden="true"><span /><span /><span /></div></section>
  if (businesses.length === 0) return null
  const repeatedBusinesses = isOverflowing && businesses.length > 1 ? [...businesses, ...businesses] : businesses
  const duration = Math.max(22, 45 - Math.max(0, businesses.length - 3) * 4)
  return <section className="trusted-businesses-section" aria-labelledby="trusted-businesses-title">
    <div className="trusted-businesses-heading"><p className="eyebrow">Cada vez somos más</p><h2 id="trusted-businesses-title">Ellos ya confían en nosotros.</h2></div>
    <div className="trusted-marquee-viewport" ref={viewportRef}><div className={`trusted-marquee-track${isOverflowing ? ' is-animated' : ''}`} ref={trackRef} style={{ '--trusted-marquee-duration': `${duration}s` } as CSSProperties}>
      {repeatedBusinesses.map((business, index) => { const isDuplicate = index >= businesses.length; const logo = logoUrl(business.logo_path); return <a className="trusted-business" href={`/${business.slug}`} key={`${business.slug}-${index}`} aria-label={`Ver la página de ${business.name}`} aria-hidden={isDuplicate || undefined} tabIndex={isDuplicate ? -1 : undefined}>
        <span className="trusted-business-logo">{logo ? <img src={logo} alt="" /> : <Storefront size={24} aria-hidden="true" />}</span><span>{business.name}</span>
      </a> })}
    </div></div>
  </section>
}

export function LandingScreen() {
  const session = useSession()
  useEffect(() => {
    document.title = 'Reservas online y agenda para tu negocio · Cale'
  }, [])
  const signedIn = session.status === 'signed-in'
  const panelAction = () => window.location.assign(signedIn ? '/panel' : '/#precios')
  const panelActionLabel = signedIn ? 'Ir a mi negocio' : 'Empezá Gratis'
  const authError = new URLSearchParams(window.location.hash.slice(1)).has('error')
  return <div className="marketing-shell">
    <header className="marketing-header"><a href="/" aria-label="Cale"><Brand /></a><div className="natural-marketing-navigation flex items-center gap-3"><a className="natural-how-link" href="#precios">Precios</a><button className="natural-how-link" onClick={() => document.getElementById('como-funciona')?.scrollIntoView({behavior:'instant'})}>Cómo funciona</button><button className="landing-small-cta" onClick={panelAction}>{panelActionLabel}</button></div></header>
    {authError && <p role="alert" className="rounded-xl bg-warn-bg p-4 text-warn">No pudimos completar el ingreso con Google. Tocá Empezá Gratis para volver a intentarlo.</p>}
    <main>
      <section className="landing-hero">
        <div className="natural-hero-copy flex flex-col items-start gap-6">
          <p className="eyebrow">Tu negocio, con más espacio para vos</p>
          <h1>Tus reservas online, <span className="text-link">tu día en orden.</span></h1>
          <p className="max-w-lg text-lg text-muted">Tus clientes eligen su turno desde tu propio link o QR. Vos recibís las reservas y organizás tu día en una sola agenda.</p>
          <div className="flex w-full flex-wrap gap-3"><button className={`${PRIMARY_BUTTON} sm:w-auto`} onClick={panelAction}>{panelActionLabel}<ArrowRight size={20} aria-hidden="true" /></button><button className={SECONDARY_BUTTON} onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>Ver cómo funciona</button></div>
          <p className="flex items-center gap-2 text-sm text-muted"><Clock size={18} aria-hidden="true" />Recordatorios automáticos por WhatsApp</p>
        </div>
        <BookingPreview />
      </section>
      <TrustedBusinesses />
      <section id="como-funciona" className="natural-how-section"><h2>Un comienzo simple.</h2><ol>{[
        {title:'Tu negocio',text:'Cargá tu negocio, servicios, horarios y tus colores de marca.'},
        {title:'Tu link',text:'Compartilo en Instagram, WhatsApp o con un QR físico en tu negocio.'},
        {title:'Tu agenda',text:'Recibí notificaciones de nuevos turnos y gestioná tus reservas.'},
      ].map(({title,text},index)=><li key={title}><span>0{index+1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol></section>
      <section className="landing-band"><div><p className="eyebrow">Todo en un mismo lugar</p><h2>Tu agenda.<br />Tu link. Tu ritmo.</h2></div><dl className="landing-facts"><div><dt><CalendarBlank aria-hidden="true" />Agenda propia</dt><dd>Turnos online y cargados a mano.</dd></div><div><dt><QrCode aria-hidden="true" />Link y QR</dt><dd>Una página de reservas para tu negocio.</dd></div><div><dt><Bell aria-hidden="true" />Recordatorios</dt><dd>Nuevos turnos, cancelaciones y cambios de horario, siempre al tanto.</dd></div></dl></section>
      <section className="natural-reminder-section"><div><p className="eyebrow">Recordatorios automáticos por WhatsApp</p><h2>Un recordatorio,<br />menos olvidos.</h2><p>Tus clientes pueden confirmar o cancelar desde el mensaje. Los avisos salen del número que tu negocio ya usa.</p></div><ReminderExample businessName="Negocio demo" /></section>
      <PricingSection />
      <section className="landing-section faq-section"><div className="section-heading"><p className="eyebrow">Preguntas que aparecen</p><h2>Lo importante,<br />sin vueltas.</h2></div><div>{FAQ.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
      <section className="landing-closing"><p className="eyebrow">Empezá por tu negocio</p><h2>Dale un lugar a tus turnos.</h2><p className="mt-4 text-muted">Una agenda clara para vos. Una forma simple de reservar para tus clientes.</p><button className={`${PRIMARY_BUTTON} mt-6 sm:w-auto`} onClick={panelAction}>{panelActionLabel}<ArrowRight aria-hidden="true" /></button></section>
    </main>
    <footer className="marketing-footer"><Brand /><p className="text-sm text-muted">Reservas online y agenda para tu negocio.</p><div className="flex flex-wrap gap-3">{[['Privacidad','/privacidad'],['Términos','/terminos'],['Eliminar datos','/eliminar-datos']].map(([label, path]) => <button className="footer-button" key={path} onClick={() => window.location.assign(`https://cale.com.ar${path}`)}>{label}</button>)}</div></footer>
  </div>
}
