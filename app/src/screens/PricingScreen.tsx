import { ArrowRight, Check, Crown, Sparkle, WhatsappLogo } from '@phosphor-icons/react'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui.ts'

const plans = [
  {
    name: 'Gratis',
    eyebrow: 'Para empezar',
    description: 'Todo lo necesario para ordenar tu agenda y recibir reservas online.',
    price: '$0',
    cadence: 'para siempre',
    icon: Check,
    features: ['Página pública y link de reservas', 'Agenda propia y turnos manuales', 'Servicios y horarios', 'Notificaciones de la app', 'Colores y logo de tu negocio'],
    action: 'Empezá Gratis',
    href: '/empezar?plan=gratis',
    featured: false,
  },
  {
    name: 'Pro',
    eyebrow: 'Para crecer',
    description: 'Pro está preparado para sumar funciones avanzadas cuando la conexión con WhatsApp esté disponible.',
    price: '$14.999',
    cadence: 'por mes',
    icon: WhatsappLogo,
    features: ['Todo lo de Gratis', 'Recordatorios por WhatsApp · Próximamente', 'Avisos de nuevos turnos · Próximamente', 'Avisos de cancelaciones y cambios · Próximamente', 'Configuración de anticipación · Próximamente'],
    action: 'Elegir Pro',
    href: '/empezar?plan=pro',
    featured: true,
  },
  {
    name: 'Enterprise',
    eyebrow: 'Para equipos y marcas',
    description: 'La experiencia completa, adaptada a la identidad y necesidades de tu negocio.',
    price: 'A consultar',
    cadence: '',
    icon: Crown,
    features: ['Todo lo de Pro', 'Personalización avanzada', 'Acompañamiento dedicado', 'Configuración para múltiples sucursales', 'Propuesta a medida'],
    action: 'Hablar con Cale',
    href: 'mailto:cale.turnos@gmail.com?subject=Consulta%20plan%20Enterprise',
    featured: false,
  },
] as const

export function PricingSection() {
  return <section id="precios" className="pricing-section">
      <div className="pricing-intro"><p className="eyebrow">Planes claros para cada etapa</p><h2>Empezá gratis.<br /><span className="text-link">Crecé cuando quieras.</span></h2><p>Usá Cale para ordenar tus turnos desde el primer día. Las funciones automáticas de WhatsApp estarán disponibles próximamente.</p></div>
      <section className="pricing-grid" aria-label="Planes de Cale">
        {plans.map(({ name, eyebrow, description, price, cadence, icon: Icon, features, action, href, featured }) => <article className={`pricing-card${featured ? ' is-featured' : ''}`} key={name}>
          {featured && <span className="pricing-badge"><Sparkle size={15} />Más elegido</span>}
          <div className="pricing-card-heading"><span className="pricing-icon"><Icon size={24} weight="bold" /></span><div><p className="eyebrow">{eyebrow}</p><h2>{name}</h2></div></div>
          <p className="pricing-description">{description}</p>
          <p className="pricing-price">{price} {cadence && <small>{cadence}</small>}</p>
          <ul>{features.map(feature => <li key={feature}><Check size={18} weight="bold" aria-hidden="true" />{feature}</li>)}</ul>
          <a className={featured ? PRIMARY_BUTTON : SECONDARY_BUTTON} href={href}>{action}<ArrowRight size={18} aria-hidden="true" /></a>
        </article>)}
      </section>
      <p className="pricing-note"><strong>Importante:</strong> la versión Gratis no vence. Incluye todas las funciones de agenda y reservas; las funciones automáticas de WhatsApp están en preparación.</p>
    </section>
}
