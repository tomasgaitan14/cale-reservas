import { dayStartInstant, todayInArgentina } from './dates.ts'
import { supabase } from './supabase.ts'

export interface BusinessMetrics {
  upcomingAppointments: number
  monthAppointments: number
  clients: number
}

function nextMonthStart(date: string) {
  const [year = 1970, month = 1] = date.split('-').map(Number)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
}

export async function fetchBusinessMetrics(businessId: string): Promise<BusinessMetrics> {
  const today = todayInArgentina()
  const monthStart = `${today.slice(0, 8)}01`
  const nextStart = nextMonthStart(today)
  const [upcoming, month, clients] = await Promise.all([
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('business_id', businessId).neq('status', 'cancelled').gte('starts_at', dayStartInstant(today)),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('business_id', businessId).neq('status', 'cancelled').gte('starts_at', dayStartInstant(monthStart)).lt('starts_at', dayStartInstant(nextStart)),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
  ])
  if (upcoming.error) throw upcoming.error
  if (month.error) throw month.error
  if (clients.error) throw clients.error
  return { upcomingAppointments: upcoming.count ?? 0, monthAppointments: month.count ?? 0, clients: clients.count ?? 0 }
}
