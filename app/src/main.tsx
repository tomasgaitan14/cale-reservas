import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './natural.css'

const container = document.getElementById('root')
if (!container) throw new Error('Falta el elemento #root en index.html')

// Keep the prerendered home visible while its interactive component loads.
// Other routes load the authenticated app only when needed.
async function start() {
  const Screen = window.location.pathname === '/'
    ? (await import('./screens/LandingScreen.tsx')).LandingScreen
    : (await import('./App.tsx')).App
  createRoot(container!).render(
    <StrictMode><div className="natural-theme"><Screen /></div></StrictMode>,
  )
}
void start()
