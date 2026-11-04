import { beforeEach, describe, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ maybeSingle: vi.fn(), upsert: vi.fn(), select: vi.fn(), eq: vi.fn(), from: vi.fn() }))
vi.mock('../../app/src/lib/supabase.ts', () => ({ supabase: { from: api.from } }))
import { defaultPreferences, fetchPreferences, PreferencesError, savePreferences } from '../../app/src/lib/preferences.ts'

beforeEach(() => {
  vi.resetAllMocks()
  api.from.mockReturnValue({ select: api.select, upsert: api.upsert })
  api.select.mockReturnValue({ eq: api.eq })
  api.eq.mockReturnValue({ maybeSingle: api.maybeSingle })
})
describe('preferencias persistidas por negocio', () => {
  it('una cuenta nueva empieza sin lista de espera ni alta completada', async () => {
    api.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await fetchPreferences('business-demo')).toEqual({ business_id: 'business-demo', reminder_hours: 24, whatsapp_waitlist: false, reminders_reviewed: false, onboarding_completed: false })
    expect(api.eq).toHaveBeenCalledWith('business_id', 'business-demo')
  })
  it('retoma las preferencias guardadas sin reemplazarlas por los valores iniciales', async () => {
    const saved = { ...defaultPreferences('business-demo'), reminder_hours: 48, whatsapp_waitlist: true, reminders_reviewed: true }
    api.maybeSingle.mockResolvedValue({ data: saved, error: null })
    expect(await fetchPreferences('business-demo')).toEqual(saved)
  })
  it('un error de lectura no se trata como una cuenta nueva', async () => {
    api.maybeSingle.mockResolvedValue({ data: null, error: { code: '42501' } })
    await expect(fetchPreferences('business-demo')).rejects.toBeInstanceOf(PreferencesError)
  })
  it('guarda el negocio y todos los pasos en una sola operación', async () => {
    api.upsert.mockResolvedValue({ error: null })
    const value = { ...defaultPreferences('business-demo'), onboarding_completed: true }
    await savePreferences(value)
    expect(api.upsert).toHaveBeenCalledWith(value, { onConflict: 'business_id' })
  })
  it('propaga el rechazo de guardado para no avanzar sin persistir', async () => {
    api.upsert.mockResolvedValue({ error: { code: '42501' } })
    await expect(savePreferences(defaultPreferences('business-demo'))).rejects.toBeInstanceOf(PreferencesError)
  })
})
