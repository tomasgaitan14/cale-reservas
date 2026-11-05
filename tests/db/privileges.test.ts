import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AUDIT_SQL, comparePrivileges, DEFAULT_ACLS_SQL, hasPrivilegeProblems, parseAuditLines, PRODUCTION_TABLE_DEFAULT_ACL, API_ROLES, type Manifest } from '../../scripts/privileges-check.ts'
import { INSUFFICIENT_PRIVILEGE } from '../support/pg-errors.ts'
import { psql } from '../support/psql.ts'
import { anonymousClient, adminClient, newUserClient } from '../support/users.ts'

const RESET_HINT = 'La base local no tiene los permisos por defecto de producción: reiniciarla con `npm run db:reset:parity` (un `supabase db reset` común no sirve).'
const WHATSAPP_TABLES = ['whatsapp_connections', 'reminder_deliveries'] as const

const manifest = JSON.parse(readFileSync(new URL('../../supabase/privileges.json', import.meta.url), 'utf8')) as Manifest
const tablePrivilege = (role: string, table: string, privilege: string) => psql(`select has_table_privilege('${role}', 'public.${table}', '${privilege}')`) === 't'

describe('paridad de permisos entre local y producción', () => {
  // Si falla este, los demás de este archivo no dicen nada: un objeto sin GRANT explícito pasaría acá y fallaría en producción
  it('la base local tiene los permisos por defecto de producción', () => {
    const acls = JSON.parse(psql(DEFAULT_ACLS_SQL)) as { tables?: string; functions?: string }
    expect(acls.tables, RESET_HINT).toBe(PRODUCTION_TABLE_DEFAULT_ACL)
    for (const role of API_ROLES) expect(acls.functions ?? '', RESET_HINT).not.toContain(`${role}=`)
  })

  it('una tabla nueva sin GRANT explícito no le da permisos de datos a nadie, como en producción', () => {
    const table = `parity_probe_${Date.now()}`
    psql(`create table public.${table} (id int)`)
    try {
      for (const role of API_ROLES) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) expect(tablePrivilege(role, table, privilege), `${role} ${privilege}`).toBe(false)
      }
    } finally {
      psql(`drop table public.${table}`)
    }
  })

  it('los permisos de todas las tablas, vistas y funciones coinciden con supabase/privileges.json', () => {
    const comparison = comparePrivileges(manifest, parseAuditLines([{ lines: psql(AUDIT_SQL) }]))
    expect(comparison.different).toEqual([])
    expect(comparison.unexpected).toEqual([])
    expect(comparison.missing).toEqual([])
    expect(hasPrivilegeProblems(comparison)).toBe(false)
  })
})

describe.each(WHATSAPP_TABLES)('permisos de %s', (table) => {
  it('el servidor (service_role) lee y escribe', () => {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) expect(tablePrivilege('service_role', table, privilege), privilege).toBe(true)
  })

  it('el servidor no recibe más que permisos de datos para esta tabla de forma explícita', () => {
    // TRUNCATE, REFERENCES, TRIGGER y MAINTAIN llegan solo por los permisos por defecto; no se conceden a propósito
    const row = manifest.objects.find(line => line.startsWith(`table ${table} |`))
    expect(row).toContain('service_role=SELECT,INSERT,UPDATE,DELETE')
  })

  it('ni sin sesión ni con sesión de usuario se puede leer ni escribir', async () => {
    const user = await newUserClient()
    for (const client of [anonymousClient(), user]) {
      expect((await client.from(table).select('id').limit(1)).error?.code).toBe(INSUFFICIENT_PRIVILEGE)
      expect((await client.from(table).delete().not('id', 'is', null)).error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    }
  })

  it('con la clave del servidor, la API las lee', async () => {
    const result = await adminClient().from(table).select('id').limit(1)
    expect(result.error).toBeNull()
  })
})

describe('lo que el servidor necesita ejecutar', () => {
  const SERVER_FUNCTIONS = ['create_booking', 'claim_push_jobs', 'finish_push_job', 'ingest_whatsapp_events'] as const

  it.each(SERVER_FUNCTIONS)('%s: la ejecuta service_role con un GRANT explícito', (name) => {
    const oid = `(select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '${name}')`
    expect(psql(`select has_function_privilege('service_role', ${oid}, 'EXECUTE')`)).toBe('t')
    expect(psql(`select has_function_privilege('anon', ${oid}, 'EXECUTE')`)).toBe('f')
    expect(psql(`select has_function_privilege('authenticated', ${oid}, 'EXECUTE')`)).toBe('f')
  })
})
