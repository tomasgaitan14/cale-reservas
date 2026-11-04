import { supabase } from './supabase.ts'

const client = supabase
export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const registration = await navigator.serviceWorker.getRegistration('/panel')
  return registration ? registration.pushManager.getSubscription() : null
}
export async function pushEnabledForBusiness(businessId: string): Promise<boolean> {
  const subscription = await currentPushSubscription()
  if (!subscription) return false
  const { data, error } = await client.rpc('has_push_subscription', { p_business_id: businessId, p_endpoint: subscription.endpoint })
  if (error) throw new Error('No pudimos comprobar la activación en Cale.')
  return data === true
}
export async function enablePush(businessId: string): Promise<void> {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!key) throw new Error('Estamos terminando de configurar las notificaciones.')
  // Solicitar el permiso directamente desde el clic de la persona.
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Las notificaciones no están permitidas. Podés habilitarlas desde Ajustes del iPhone.')
  const registration = await navigator.serviceWorker.getRegistration('/panel')
  if (!registration?.active) throw new Error('Cerrá y volvé a abrir Cale para terminar de preparar las notificaciones.')
  const padding = '='.repeat((4 - key.length % 4) % 4)
  const bytes = Uint8Array.from(atob((key + padding).replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))
  let subscription = await registration.pushManager.getSubscription()
  const created = !subscription
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
  const value = subscription.toJSON()
  const { error } = await client.rpc('register_push_subscription', { p_business_id: businessId, p_endpoint: subscription.endpoint, p_p256dh: value.keys?.p256dh ?? '', p_auth: value.keys?.auth ?? '' })
  if (error) { if (created) await subscription.unsubscribe(); throw new Error('No pudimos guardar la activación. Probá nuevamente.') }
}
export async function disablePush(): Promise<void> {
  const subscription = await currentPushSubscription()
  if (!subscription) return
  const { error } = await client.rpc('remove_push_subscription', { p_endpoint: subscription.endpoint })
  if (error) throw new Error('No pudimos desactivar los avisos de este dispositivo. Probá nuevamente.')
  await subscription.unsubscribe()
}
export async function testPush(): Promise<void> {
  const subscription = await currentPushSubscription()
  if (!subscription) throw new Error('Primero activá las notificaciones en este dispositivo.')
  const { error } = await client.rpc('request_push_test', { p_endpoint: subscription.endpoint })
  if (error) throw new Error('No pudimos pedir la prueba. Esperá un minuto y probá nuevamente.')
}
export async function signOutWithPush() {
  try { await disablePush() } catch { return { error: new Error('No pudimos desactivar los avisos antes de salir. Revisá tu conexión y probá nuevamente.') } }
  return supabase.auth.signOut()
}
