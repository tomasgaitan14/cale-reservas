type AnalyticsWindow = Window & {
  dataLayer?: unknown[]
}

const gtmId = import.meta.env.VITE_GTM_ID?.trim()
const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()

/** Load the environment-specific GTM container once, only in the browser. */
export function initializeAnalytics() {
  if (typeof window === 'undefined' || !gtmId) return

  const analyticsWindow = window as AnalyticsWindow
  analyticsWindow.dataLayer ??= []
  if (!analyticsWindow.dataLayer.some(entry => typeof entry === 'object' && entry !== null && 'event' in entry && entry.event === 'gtm.js')) {
    analyticsWindow.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js', measurement_id: measurementId || undefined })
  }
  if (document.querySelector(`script[data-cale-gtm="${gtmId}"]`)) return

  const script = document.createElement('script')
  script.async = true
  script.dataset.caleGtm = gtmId
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`
  document.head.appendChild(script)
}
