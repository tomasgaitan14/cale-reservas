import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Bell, CalendarBlank, Check, Clock, Desktop, DeviceMobile, GearSix, LinkSimple, Scissors, Storefront } from '@phosphor-icons/react'
import QRCode from 'qrcode'
import { Brand } from '../components/Brand.tsx'
import { Modal } from '../components/Modal.tsx'
import { AgendaDemo } from './AgendaDemo.tsx'
import { BookingDemo } from './BookingDemo.tsx'
import { DESIGN_VARIANTS, DESIGN_LABELS, DESIGN_DESCRIPTIONS, designScreen, type DesignVariant, type DesignScreen } from './model.ts'
import './design-preview.css'

const TABS = [{screen:'agenda',label:'Agenda',icon:CalendarBlank},{screen:'negocio',label:'Negocio',icon:Storefront},{screen:'avisos',label:'Avisos',icon:Bell},{screen:'ajustes',label:'Ajustes',icon:GearSix}] as const
function Plant() {
  return <svg viewBox="0 0 150 240" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" className="dv-plant"><path d="M71 224C76 156 87 89 109 17M87 127C49 125 33 102 29 79 64 81 88 99 87 127ZM95 92C126 82 137 60 135 40 113 48 100 66 95 92ZM78 172C40 174 18 159 10 139 41 134 68 145 78 172ZM104 52C85 36 85 16 93 4 107 19 113 35 104 52ZM83 151C122 146 137 126 141 105 110 109 91 126 83 151Z" /></svg>
}
function DesignLanding({ variant, navigate }: {variant:DesignVariant;navigate:(screen:DesignScreen)=>void}) {
  const content = <div className="dv-hero-copy"><p className="dv-kicker">Para negocios que trabajan con turnos</p><h1>Reservas y recordatorios de turnos, <em>en automático.</em></h1><p className="dv-hero-description">Tus clientes reservan online en tu propio link y Cale les recuerda el turno por WhatsApp. Vos ves todo en tu agenda.</p><div className="dv-hero-actions"><button className="dv-button" onClick={() => navigate('agenda')}>Empezá Gratis<ArrowRight size={20} /></button><button className="dv-button dv-secondary" onClick={() => document.getElementById('dv-how')?.scrollIntoView({behavior:'instant'})}>Ver cómo funciona</button></div><p className="dv-availability"><Clock size={18} />WhatsApp · Próximamente</p></div>
  return <><header className="dv-marketing-header"><div className="dv-logo"><Brand /></div><nav aria-label="Navegación de portada"><button className="dv-text-button" onClick={() => document.getElementById('dv-how')?.scrollIntoView({behavior:'instant'})}>Cómo funciona</button><button className="dv-button dv-secondary" onClick={() => navigate('agenda')}>Ingresar</button></nav></header><main className="dv-marketing-main"><section className="dv-hero">{content}<div className="dv-hero-visual"><BookingDemo compact />{variant === 'natural' && <Plant />}{variant === 'editorial' && <span className="dv-editorial-caption">Un espacio propio<br />para tus turnos.</span>}</div></section><section className="dv-how" id="dv-how"><h2>Un comienzo simple.</h2>{[{title:'Tu negocio',text:'Cargá tus servicios y horarios.',icon:Check},{title:'Tu link',text:'Compartilo por WhatsApp o con un QR.',icon:LinkSimple},{title:'Tu agenda',text:'Recibí y gestioná tus reservas.',icon:CalendarBlank}].map(({title,text,icon:Icon},index) => <div key={title}><span className="dv-step-number">0{index+1}</span><Icon size={24} /><h3>{title}</h3><p>{text}</p></div>)}</section><section className="dv-marketing-bottom"><div><p className="dv-kicker">Menos idas y vueltas</p><h2>Una agenda clara para vos.<br />Una reserva simple para tus clientes.</h2></div><button className="dv-button dv-secondary" onClick={() => navigate('reserva')}>Probar una reserva<ArrowUpRight size={18} /></button></section></main><footer className="dv-marketing-footer"><div className="dv-logo"><Brand /></div><p>Propuesta de diseño · contenido de demostración</p></footer></>
}
function BusinessDemo({ navigate, onQr }: {navigate:(screen:DesignScreen)=>void;onQr:()=>void}) {
  return <section className="dv-secondary-screen"><p className="dv-kicker">Tu negocio</p><h1>Todo a tu manera.</h1><p>Los datos y la disponibilidad que ven tus clientes.</p><div className="dv-business-columns"><section><h2>Negocio demo</h2><p className="dv-summary">cale.com.ar/negocio-demo</p><div className="dv-business-line"><Scissors size={22} /><span><strong>Corte de pelo</strong><span>60 minutos</span></span></div><div className="dv-business-line"><Scissors size={22} /><span><strong>Limpieza facial</strong><span>60 minutos</span></span></div><p className="dv-small">Servicios de demostración · solo para comparar el diseño.</p></section><section><h2>Tus horarios</h2><div className="dv-business-line"><CalendarBlank size={22} /><span><strong>Lunes a viernes</strong><span>09:00 a 18:00</span></span></div><div className="dv-business-line"><Clock size={22} /><span><strong>Descanso</strong><span>12:00 a 13:00</span></span></div><button className="dv-button" onClick={() => navigate('reserva')}>Ver mi página<ArrowUpRight size={18} /></button><button className="dv-button dv-secondary" onClick={onQr}>Ver QR de ejemplo</button></section></div></section>
}
function NoticesDemo() {
  const [hours,setHours]=useState(24)
  const [waitlist,setWaitlist]=useState(false)
  const [saved,setSaved]=useState(false)
  return <section className="dv-secondary-screen"><p className="dv-kicker">Avisos · Próximamente</p><h1>Un recordatorio,<br />menos olvidos.</h1><p>Desde el WhatsApp que ya usás en tu negocio.</p><div className="dv-notices-layout"><figure className="dv-message"><figcaption>Vista previa · ejemplo</figcaption><p>Hola Cliente demo, te recordamos tu turno en Negocio demo el jueves a las 17:30. ¿Nos confirmás si venís?</p><div><span>Confirmo</span><span>Cancelo</span></div></figure><div><h2>¿Cuánto antes querés avisar?</h2><div className="dv-reminder-options">{[24,48,2].map(value => <button className="dv-button dv-secondary" key={value} aria-pressed={hours===value} onClick={() => { setHours(value);setSaved(false) }}>{value} h antes</button>)}</div><label className="dv-check"><input type="checkbox" checked={waitlist} onChange={event => {setWaitlist(event.target.checked);setSaved(false)}} />Sumarme a la lista de espera</label><p className="dv-small">En esta maqueta no se guarda la preferencia ni se conecta WhatsApp.</p><button className="dv-button" onClick={() => setSaved(true)}>Probar guardado</button>{saved && <p role="status" className="dv-notice">Así se vería la confirmación. No se guardó ningún dato.</p>}</div></div></section>
}
export function DesignPreview({ variant }: {variant:DesignVariant}) {
  const [screen,setScreen]=useState<DesignScreen>(()=>designScreen(window.location.search))
  const [phone,setPhone]=useState(false)
  const [qrOpen,setQrOpen]=useState(false)
  const [qr,setQr]=useState('')
  const [qrError,setQrError]=useState(false)
  const embedded=new URLSearchParams(window.location.search).has('embed')
  useEffect(()=> {document.title=`${DESIGN_LABELS[variant]} · Propuesta de Cale`},[variant])
  useEffect(()=> {
    const onPop=()=>setScreen(designScreen(window.location.search))
    window.addEventListener('popstate',onPop)
    return ()=>window.removeEventListener('popstate',onPop)
  },[])
  useEffect(()=> {
    if(!qrOpen) return
    let active=true
    setQr('');setQrError(false)
    const url=new URL(`/disenos/${variant}?vista=reserva`,window.location.origin).href
    QRCode.toString(url,{type:'svg',margin:4,width:240}).then(svg=>{if(active)setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)}).catch(()=>{if(active)setQrError(true)})
    return ()=>{active=false}
  },[qrOpen,variant])
  function navigate(next:DesignScreen) {
    setScreen(next)
    const params=new URLSearchParams(window.location.search)
    params.set('vista',next)
    window.history.pushState({},'',`/disenos/${variant}?${params}`)
    if(!embedded) window.scrollTo({top:0,behavior:'instant'})
  }
  const productNavigation=<nav aria-label="Secciones de demostración" className="dv-product-nav">{TABS.map(({screen:item,label,icon:Icon})=><button type="button" key={item} aria-current={screen===item?'page':undefined} onClick={()=>navigate(item)}><Icon size={21}/><span>{label}</span></button>)}</nav>
  const dashboard=<div className={`dv-dashboard dv-dashboard-${variant}`}>
    {variant==='clara'?<aside className="dv-sidebar"><div className="dv-logo"><Brand/></div>{productNavigation}<button className="dv-text-button dv-sidebar-home" onClick={()=>navigate('portada')}>Ver portada<ArrowUpRight size={17}/></button></aside>:<header className="dv-product-header"><div className="dv-logo"><Brand/></div>{productNavigation}<button className="dv-business-switch" onClick={()=>navigate('negocio')}><span>N</span>Negocio demo</button></header>}
    <main className="dv-workspace">
      {screen==='agenda'?<AgendaDemo variant={variant} onReserve={()=>navigate('reserva')} onQr={()=>setQrOpen(true)}/>:screen==='negocio'?<BusinessDemo navigate={navigate} onQr={()=>setQrOpen(true)}/>:screen==='avisos'?<NoticesDemo/>:<section className="dv-secondary-screen"><p className="dv-kicker">Ajustes</p><h1>Tu cuenta, a mano.</h1><div className="dv-settings-row"><h2>Cuenta de demostración</h2><p>Este espacio sirve para comparar los diseños.</p></div><div className="dv-settings-row"><h2>Ayuda e instalación</h2><p>El contenido y las opciones finales se incorporan al elegir el diseño.</p></div><button className="dv-button dv-secondary" onClick={()=>navigate('portada')}>Volver a la portada</button></section>}
    </main></div>
  return <div className={`design-prototype dv-${variant}`}>
    {!embedded&&<div className="dv-reviewbar"><div className="dv-reviewbar-heading"><span>Diseños de Cale</span><span>Maquetas interactivas · datos de demostración</span></div><div className="dv-review-options">{DESIGN_VARIANTS.map((item,index)=><button key={item} aria-pressed={variant===item} onClick={()=>window.location.assign(`/disenos/${item}?vista=${screen}`)}><strong>{String(index+1).padStart(2,'0')}</strong>{DESIGN_LABELS[item]}</button>)}</div><div className="dv-review-tools"><div className="dv-screen-picker" aria-label="Pantallas de la propuesta">{(['portada','agenda','reserva'] as const).map(item=><button key={item} aria-pressed={screen===item} onClick={()=>navigate(item)}>{item==='portada'?'Portada':item==='agenda'?'Agenda':'Reserva'}</button>)}</div><p>{DESIGN_DESCRIPTIONS[variant]}</p><div className="dv-device-picker"><button aria-pressed={!phone} onClick={()=>setPhone(false)}><Desktop size={17}/>Escritorio</button><button aria-pressed={phone} onClick={()=>setPhone(true)}><DeviceMobile size={17}/>Celular</button></div></div></div>}
    {phone&&!embedded?<div className="dv-device-stage"><div className="dv-phone"><iframe title={`Vista móvil · ${DESIGN_LABELS[variant]}`} key={`${variant}-${screen}`} src={`/disenos/${variant}?vista=${screen}&embed=1`}/></div><p>Vista móvil de 375 px · podés navegar dentro de la pantalla.</p></div>:<div className="dv-product-surface">{screen==='portada'?<DesignLanding variant={variant} navigate={navigate}/>:screen==='reserva'?<><header className="dv-reservation-header"><button className="dv-logo dv-logo-button" aria-label="Volver a la portada" onClick={()=>navigate('portada')}><Brand/></button><span>Reservas online · demostración</span></header><main className="dv-reservation-layout"><div className="dv-reservation-intro"><p className="dv-kicker">Negocio demo</p><h1>Un turno que te quede bien.</h1><p>Elegí el servicio, el día y el horario. Son solo unos pasos.</p></div><BookingDemo/></main></>:dashboard}</div>}
    {qrOpen&&<Modal title="QR de demostración" onClose={()=>setQrOpen(false)}>{qr?<img src={qr} alt="QR que abre la maqueta de reservas" width={240} height={240} className="mx-auto"/>:<p role="status">{qrError?'No pudimos generar el QR.':'Preparando el QR…'}</p>}<p className="dv-small">Abre la propuesta local. No corresponde a un negocio real ni sirve para compartir fuera de esta computadora.</p></Modal>}
  </div>
}
