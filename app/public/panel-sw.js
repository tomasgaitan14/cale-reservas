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

self.addEventListener('push', event => {
  // Todo push muestra un aviso visible; nunca usamos push silencioso.
  let message = {}
  try { message = event.data?.json() ?? {} } catch { /* Usar texto genérico ante un payload inválido. */ }
  event.waitUntil(self.registration.showNotification(typeof message.title === 'string' && message.title.trim() ? message.title : 'Novedades en tu agenda', {
    body: typeof message.body === 'string' ? message.body : 'Hay novedades en tu agenda.',
    icon: '/icons/cale-192.png', badge: '/icons/cale-192.png',
    tag: typeof message.tag === 'string' ? message.tag : 'cale-agenda',
    data: { url: '/panel' },
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const panel = windows.find(client => new URL(client.url).origin === self.location.origin && new URL(client.url).pathname === '/panel')
    if (panel) return panel.focus()
    return self.clients.openWindow('/panel')
  })())
})
