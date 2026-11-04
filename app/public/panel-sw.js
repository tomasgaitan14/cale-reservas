// No se guardan en caché sesiones, turnos ni respuestas de Supabase.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.mode !== 'navigate' || url.origin !== self.location.origin || !(url.pathname === '/panel' || url.pathname.startsWith('/panel/'))) return
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cale · Sin conexión</title><main><h1>Necesitás conexión para abrir tu agenda</h1><p>Conectate a internet y volvé a intentar. Tus turnos se guardan en Cale.</p><a href="/panel">Volver a intentar</a></main></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )))
})
