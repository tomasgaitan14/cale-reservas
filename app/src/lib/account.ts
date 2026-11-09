import { supabase } from './supabase.ts'

export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirmation: 'ELIMINAR' } })
  if (error) throw new Error('No pudimos eliminar tu cuenta. Probá nuevamente.')
  if (!data || data.ok !== true) {
    if (data?.error === 'shared_business') throw new Error('Tu negocio tiene otros usuarios asociados. Contactanos para eliminar la cuenta sin afectar su acceso.')
    throw new Error('No pudimos eliminar tu cuenta. Probá nuevamente.')
  }
  await supabase.auth.signOut({ scope: 'local' })
}
