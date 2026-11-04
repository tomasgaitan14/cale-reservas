import { useEffect } from 'react'

// La instalación corresponde al panel, no a la página pública de reservas.
export function usePanelPwa() {
  useEffect(() => {
    const path = window.location.pathname
    if (!(path === '/panel' || path.startsWith('/panel/') || path === '/empezar')) return
    const manifest = document.createElement('link')
    manifest.rel = 'manifest'; manifest.href = '/manifest.webmanifest'
    document.head.append(manifest)
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/panel-sw.js', { scope: '/panel' }).catch(() => {
        // El panel sigue funcionando por red si el navegador no admite el registro.
      })
    }
    return () => manifest.remove()
  }, [])
}
