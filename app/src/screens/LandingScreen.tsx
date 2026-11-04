import { useEffect } from 'react'
import { ArrowRight, CalendarBlank, Clock, QrCode } from '@phosphor-icons/react'
import { ReminderExample } from '../components/ReminderExample.tsx'
import { BookingPreview } from '../components/BookingPreview.tsx'
import { Brand } from '../components/Brand.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'
import { useSession } from '../hooks/useSession.ts'

const FAQ = [
  ['¿Necesito otra agenda?', 'No. Cale tiene su propia agenda dentro del panel. Ahí ves las reservas, cargás turnos a mano y bloqueás horarios.'],
  ['¿Cómo reservan mis clientes?', 'Compartís el link de tu negocio o tu QR. Tus clientes eligen un servicio, un día y un horario disponible. El turno aparece en tu agenda.'],
  ['¿Puedo cargar turnos a mano y bloquear horarios?', 'Sí. Podés cargar los turnos que te pidan por fuera de la página y bloquear descansos, vacaciones o cualquier horario en el que no atiendas.'],
  ['¿Tengo que cambiar mi número de WhatsApp?', 'No. La conexión está prevista para el número que ya usás en WhatsApp Business, para que puedas seguir viendo y respondiendo tus mensajes. Esta función está en preparación.'],
] as const
function openPanel() { window.location.assign('/panel') }
export function LandingScreen() {
  const session = useSession()
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')
  useEffect(() => {
    document.title = 'Reservas y recordatorios de turnos · Cale'
    if (session.status === 'signed-in' && !preview) window.location.replace('/panel')
  }, [session.status, preview])
  const authError = new URLSearchParams(window.location.hash.slice(1)).has('error')
  return <div className="marketing-shell">
    <header className="marketing-header"><Brand /><div className="natural-marketing-navigation flex items-center gap-3"><button className="natural-how-link" onClick={() => document.getElementById('como-funciona')?.scrollIntoView({behavior:'instant'})}>Cómo funciona</button><button className={SECONDARY_BUTTON} onClick={openPanel}>Ingresar</button><button className="landing-small-cta" onClick={openPanel}>Crear cuenta</button></div></header>
    {authError && <p role="alert" className="rounded-xl bg-warn-bg p-4 text-warn">No pudimos completar el ingreso con Google. Tocá Ingresar para volver a intentarlo.</p>}
    <main>
      <section className="landing-hero">
        <div className="natural-hero-copy flex flex-col items-start gap-6">
          <p className="eyebrow">Tu negocio, con más espacio para vos</p>
          <h1>Reservas y recordatorios de turnos, <span className="text-link">en automático.</span></h1>
          <p className="max-w-lg text-lg text-muted">Tus clientes reservan online en tu propio link y Cale les recuerda el turno por WhatsApp. Vos ves todo en tu agenda.</p>
          <div className="flex w-full flex-wrap gap-3"><button className={`${PRIMARY_BUTTON} sm:w-auto`} onClick={openPanel}>Crear mi cuenta<ArrowRight size={20} aria-hidden="true" /></button><button className={SECONDARY_BUTTON} onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>Ver cómo funciona</button></div>
          <p className="flex items-center gap-2 text-sm text-muted"><Clock size={18} aria-hidden="true" />WhatsApp · Próximamente</p>
        </div>
        <BookingPreview />
      </section>
      <section id="como-funciona" className="natural-how-section"><h2>Un comienzo simple.</h2><ol>{[
        {title:'Tu negocio',text:'Cargá tus servicios y horarios.'},
        {title:'Tu link',text:'Compartilo por WhatsApp o con un QR.'},
        {title:'Tu agenda',text:'Recibí y gestioná tus reservas.'},
      ].map(({title,text},index)=><li key={title}><span>0{index+1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol></section>
      <section className="landing-band"><div><p className="eyebrow">Todo en un mismo lugar</p><h2>Tu agenda.<br />Tu link. Tu ritmo.</h2></div><dl className="landing-facts"><div><dt><CalendarBlank aria-hidden="true" />Agenda propia</dt><dd>Turnos online y cargados a mano.</dd></div><div><dt><QrCode aria-hidden="true" />Link y QR</dt><dd>Una página de reservas para tu negocio.</dd></div><div><dt><Clock aria-hidden="true" />Elegís cuánto antes avisar</dt><dd>24 h, 48 h o 2 h antes. Próximamente.</dd></div></dl></section>
      <section className="natural-reminder-section"><div><p className="eyebrow">WhatsApp · Próximamente</p><h2>Un recordatorio,<br />menos olvidos.</h2><p>Tus clientes podrán confirmar o cancelar desde el mensaje. Los avisos saldrán del número que tu negocio ya usa.</p></div><ReminderExample businessName="Negocio demo" /></section>
      <section className="landing-section faq-section"><div className="section-heading"><p className="eyebrow">Preguntas que aparecen</p><h2>Lo importante,<br />sin vueltas.</h2></div><div>{FAQ.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
      <section className="landing-closing"><p className="eyebrow">Empezá por tu negocio</p><h2>Dale un lugar a tus turnos.</h2><p className="mt-4 text-muted">Una agenda clara para vos. Una forma simple de reservar para tus clientes.</p><button className={`${PRIMARY_BUTTON} mt-6 sm:w-auto`} onClick={openPanel}>Crear mi cuenta<ArrowRight aria-hidden="true" /></button></section>
    </main>
    <footer className="marketing-footer"><Brand /><p className="text-sm text-muted">Reservas y recordatorios para negocios con agenda.</p><div className="flex flex-wrap gap-3">{[['Privacidad','/privacidad'],['Términos','/terminos'],['Eliminar datos','/eliminar-datos']].map(([label, path]) => <button className="footer-button" key={path} onClick={() => window.location.assign(`https://cale.com.ar${path}`)}>{label}</button>)}</div></footer>
  </div>
}
