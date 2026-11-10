import { ArrowsClockwise, Crown, EnvelopeSimple, UserPlus, UsersThree, X } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent } from 'react'
import { inviteProfessional, changeTeamRole, fetchTeam, removeTeamMember, revokeTeamInvitation, TeamLoadError, type BusinessInvitation, type TeamMember, type TeamRole } from '../lib/business.ts'
import { SECONDARY_BUTTON, PRIMARY_BUTTON } from './ui.ts'
import { SelectField } from './SelectField.tsx'
import { TextField } from './TextField.tsx'

interface ProfessionalsSectionProps {
  businessId: string
  canManage: boolean
  isOwner: boolean
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; members: TeamMember[]; invitations: BusinessInvitation[] }

function roleLabel(role: TeamRole): string {
  if (role === 'owner') return 'Dueño'
  if (role === 'admin') return 'Administrador'
  return 'Profesional'
}

function formatInviteDate(value: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(new Date(value))
}

export function ProfessionalsSection({ businessId, canManage, isOwner }: ProfessionalsSectionProps) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Exclude<TeamRole, 'owner'>>('professional')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadTeam() {
    setLoad({ status: 'loading' })
    try {
      const team = await fetchTeam(businessId)
      setLoad({ status: 'ready', ...team })
    } catch (error: unknown) {
      if (!(error instanceof TeamLoadError)) throw error
      setLoad({ status: 'error' })
    }
  }

  useEffect(() => { void loadTeam() }, [businessId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !email.trim()) return
    setBusy(true); setActionError(''); setNotice('')
    try {
      const result = await inviteProfessional({ businessId, displayName: name.trim(), email: email.trim(), role })
      setName(''); setEmail('')
      setNotice(result.emailSent ? 'Invitación enviada por correo.' : 'Invitación guardada. Si ya tiene cuenta, verá el negocio al entrar con Google.')
      await loadTeam()
    } catch (error: unknown) {
      if (!(error instanceof TeamLoadError)) throw error
      setActionError('No pudimos enviar la invitación. Revisá los datos y probá de nuevo.')
    } finally { setBusy(false) }
  }

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true); setActionError(''); setNotice('')
    try { await action(); setNotice(success); await loadTeam() }
    catch (error: unknown) {
      if (!(error instanceof TeamLoadError)) throw error
      setActionError('No pudimos guardar el cambio. Probá de nuevo.')
    } finally { setBusy(false) }
  }

  return <section className="professionals-section border-t border-line pt-8" aria-labelledby="professionals-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="eyebrow">Equipo</p>
        <h2 id="professionals-title" className="text-[1.75rem]">Profesionales</h2>
        <p className="mt-2 max-w-xl text-muted">Invitá a tu equipo y asigná quién puede administrar el negocio o trabajar solo con su agenda.</p>
      </div>
      <button type="button" className={`${SECONDARY_BUTTON} shrink-0`} onClick={() => void loadTeam()} disabled={busy} aria-label="Actualizar profesionales">
        <ArrowsClockwise weight="bold" className="size-5" aria-hidden="true" />
        Actualizar
      </button>
    </div>

    {canManage ? <form className="mt-6 grid gap-4 rounded-[1.25rem] border border-line bg-surface p-5 md:grid-cols-[1fr_1fr_0.8fr_auto] md:items-end" onSubmit={submit}>
      <TextField id="professional-name" label="Nombre" placeholder="Nombre del profesional" value={name} onChange={event => setName(event.target.value)} required />
      <TextField id="professional-email" label="Correo de Google" type="email" placeholder="nombre@correo.com" value={email} onChange={event => setEmail(event.target.value)} required />
      {isOwner ? <SelectField id="professional-role" label="Permisos" value={role} options={[{ value: 'professional', label: 'Profesional' }, { value: 'admin', label: 'Administrador' }]} onChange={event => setRole(event.target.value as Exclude<TeamRole, 'owner'>)} /> : <input type="hidden" value="professional" readOnly />}
      <button type="submit" className={`${PRIMARY_BUTTON} md:w-auto`} disabled={busy || !name.trim() || !email.trim()}>
        <UserPlus weight="bold" className="size-5" aria-hidden="true" />
        {busy ? 'Enviando…' : 'Invitar'}
      </button>
    </form> : <div className="mt-6 flex items-start gap-3 rounded-[1.25rem] bg-tint p-5 text-muted"><UsersThree weight="bold" className="mt-0.5 size-6 flex-none text-link" /><p>Solo la administración puede invitar personas y administrar el equipo.</p></div>}

    {actionError ? <p className="mt-4 rounded-[12px] bg-warn-bg p-3 text-sm font-medium text-warn" role="alert">{actionError}</p> : null}
    {notice ? <p className="mt-4 text-sm font-medium text-link" role="status">{notice}</p> : null}

    {load.status === 'loading' ? <div className="mt-6 flex flex-col gap-3" role="status" aria-label="Cargando profesionales"><div className="skeleton h-16 rounded-xl" /><div className="skeleton h-16 rounded-xl" /></div> : null}
    {load.status === 'error' ? <div className="mt-6 flex flex-col items-start gap-3"><p className="text-muted">No pudimos cargar el equipo.</p><button type="button" className={SECONDARY_BUTTON} onClick={() => void loadTeam()}>Reintentar</button></div> : null}
    {load.status === 'ready' ? <div className="mt-6 divide-y divide-line border-y border-line">
      {load.members.map(member => <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 flex-none place-items-center rounded-full bg-tint text-link">{member.role === 'owner' ? <Crown weight="bold" className="size-5" aria-hidden="true" /> : <UsersThree weight="bold" className="size-5" aria-hidden="true" />}</span><div className="min-w-0"><p className="truncate font-head font-extrabold tracking-tight">{member.display_name || member.email || 'Profesional'}</p><p className="flex items-center gap-1 truncate text-sm text-muted"><EnvelopeSimple className="size-4" aria-hidden="true" />{member.email || 'Correo no disponible'}</p></div></div>
        <div className="flex items-center gap-2"><span className="rounded-full bg-tint px-3 py-1 text-sm font-semibold text-link">{roleLabel(member.role)}</span>{canManage && member.role !== 'owner' && (isOwner || member.role === 'professional') ? <><select aria-label={`Permisos de ${member.display_name || member.email || 'profesional'}`} className="field h-10 min-h-10 py-2" value={member.role} disabled={busy || !isOwner} onChange={event => void runAction(() => changeTeamRole(businessId, member.user_id, event.target.value as Exclude<TeamRole, 'owner'>), 'Permisos actualizados.')}><option value="professional">Profesional</option>{isOwner ? <option value="admin">Administrador</option> : null}</select><button type="button" className="inline-flex size-10 items-center justify-center rounded-[12px] text-warn transition hover:bg-warn-bg active:scale-[0.98]" aria-label={`Quitar a ${member.display_name || member.email || 'este profesional'}`} disabled={busy} onClick={() => { if (window.confirm('¿Quitar a esta persona del negocio?')) void runAction(() => removeTeamMember(businessId, member.user_id), 'Profesional quitado.') }}><X weight="bold" className="size-5" aria-hidden="true" /></button></> : null}</div>
      </div>)}
      {load.invitations.map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-4 bg-tint/50 py-4"><div><p className="font-head font-extrabold tracking-tight">{invitation.display_name}</p><p className="text-sm text-muted">{invitation.email} · Invitación pendiente hasta el {formatInviteDate(invitation.expires_at)}</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-line px-3 py-1 text-sm font-semibold text-muted">{roleLabel(invitation.role)}</span>{canManage && (isOwner || invitation.role === 'professional') ? <button type="button" className="inline-flex size-10 items-center justify-center rounded-[12px] text-warn transition hover:bg-warn-bg active:scale-[0.98]" aria-label={`Cancelar invitación a ${invitation.email}`} disabled={busy} onClick={() => void runAction(() => revokeTeamInvitation(invitation.id), 'Invitación cancelada.')}><X weight="bold" className="size-5" aria-hidden="true" /></button> : null}</div></div>)}
      {load.members.length === 0 && load.invitations.length === 0 ? <div className="flex flex-col items-start gap-3 py-8"><UsersThree weight="bold" className="size-8 text-link" aria-hidden="true" /><p className="font-head text-lg font-extrabold tracking-tight">Todavía no hay profesionales</p><p className="text-muted">Invitá a la primera persona para empezar a trabajar en equipo.</p></div> : null}
    </div> : null}
  </section>
}
