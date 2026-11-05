// Permisos de las tablas y funciones de `public`: el manifiesto (supabase/privileges.json) dice cuáles son los esperados, el mismo
// manifiesto lo comparan los tests contra la base local y `check-privileges.ts --remote` contra producción. Existe porque el Supabase
// local concede más permisos por defecto que producción: un objeto sin GRANT explícito funciona en local y falla en producción.
// Lógica pura: la lectura de la base y del disco está en check-privileges.ts.
import { MigrationCheckError, parseQueryRows } from './migrations-check.ts'

export interface Manifest {
  // Objetos de la plataforma que no son del esquema de la app (se ignoran), con el motivo
  ignored: Record<string, string>
  // Una línea por tabla, vista o función, con sus permisos (ver AUDIT_SQL)
  objects: string[]
}

// Una línea por objeto: "<tipo> <nombre> | ...permisos". Solo permisos de datos de tablas (SELECT, INSERT, UPDATE, DELETE) y EXECUTE de
// funciones: TRUNCATE, REFERENCES, TRIGGER y MAINTAIN no se usan desde la API. Las funciones de extensiones no se listan.
export const AUDIT_SQL = `
select coalesce(json_agg(line order by line), '[]'::json) as lines from (
  select case c.relkind when 'v' then 'view ' else 'table ' end || c.relname::text
    || ' | rls=' || c.relrowsecurity::text
    || ' | anon=' || coalesce(nullif(concat_ws(',',
         case when has_table_privilege('anon', c.oid, 'SELECT') then 'SELECT' end, case when has_table_privilege('anon', c.oid, 'INSERT') then 'INSERT' end,
         case when has_table_privilege('anon', c.oid, 'UPDATE') then 'UPDATE' end, case when has_table_privilege('anon', c.oid, 'DELETE') then 'DELETE' end), ''), '-')
    || ' | authenticated=' || coalesce(nullif(concat_ws(',',
         case when has_table_privilege('authenticated', c.oid, 'SELECT') then 'SELECT' end, case when has_table_privilege('authenticated', c.oid, 'INSERT') then 'INSERT' end,
         case when has_table_privilege('authenticated', c.oid, 'UPDATE') then 'UPDATE' end, case when has_table_privilege('authenticated', c.oid, 'DELETE') then 'DELETE' end), ''), '-')
    || ' | service_role=' || coalesce(nullif(concat_ws(',',
         case when has_table_privilege('service_role', c.oid, 'SELECT') then 'SELECT' end, case when has_table_privilege('service_role', c.oid, 'INSERT') then 'INSERT' end,
         case when has_table_privilege('service_role', c.oid, 'UPDATE') then 'UPDATE' end, case when has_table_privilege('service_role', c.oid, 'DELETE') then 'DELETE' end), ''), '-') as line
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v')
  union all
  select 'function ' || p.proname::text || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    || ' | definer=' || p.prosecdef::text
    || ' | anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
    || ' | authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
    || ' | service_role=' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
) t
`

// El nombre del objeto es lo que va antes de la primera " | "
const objectName = (line: string): string => line.split(' | ')[0] ?? line

export function parseAuditLines(rows: unknown[]): string[] {
  const first = (rows[0] ?? {}) as { lines?: unknown }
  const lines = typeof first.lines === 'string' ? (JSON.parse(first.lines) as unknown) : first.lines
  if (!Array.isArray(lines) || lines.some(line => typeof line !== 'string')) throw new MigrationCheckError('La auditoría de permisos no devolvió una lista de líneas.')
  return lines as string[]
}

export function parseRemoteAudit(output: string): string[] {
  return parseAuditLines(parseQueryRows(output))
}

export interface PrivilegesComparison {
  // Con permisos distintos a los del manifiesto, o que existen y el manifiesto no conoce: son problemas
  different: { name: string; expected: string; actual: string }[]
  unexpected: string[]
  // En el manifiesto y todavía no en la base (una migración sin aplicar): se informa, no es un error
  missing: string[]
}

export function comparePrivileges(manifest: Manifest, actualLines: readonly string[]): PrivilegesComparison {
  const ignored = new Set(Object.keys(manifest.ignored))
  const expected = new Map(manifest.objects.map(line => [objectName(line), line]))
  const actual = new Map(actualLines.filter(line => !ignored.has(objectName(line))).map(line => [objectName(line), line]))
  return {
    different: [...expected].flatMap(([name, line]) => (actual.has(name) && actual.get(name) !== line ? [{ name, expected: line, actual: actual.get(name)! }] : [])),
    unexpected: [...actual.keys()].filter(name => !expected.has(name)),
    missing: [...expected.keys()].filter(name => !actual.has(name)),
  }
}

export function hasPrivilegeProblems(comparison: PrivilegesComparison): boolean {
  return comparison.different.length > 0 || comparison.unexpected.length > 0
}

// Los permisos por defecto de los objetos nuevos que crea `postgres` en `public`, tal como están en producción (Supabase actual):
// las tablas solo dan TRUNCATE, REFERENCES, TRIGGER y MAINTAIN a los tres roles (ningún permiso de datos), y las funciones no dan
// EXECUTE a anon, authenticated ni service_role. El stack local concede todo, y entonces un objeto sin GRANT explícito parece
// funcionar en local y falla en producción.
export const PRODUCTION_TABLE_DEFAULT_ACL = '{anon=Dxtm/postgres,authenticated=Dxtm/postgres,service_role=Dxtm/postgres}'
export const API_ROLES = ['anon', 'authenticated', 'service_role'] as const

export const DEFAULT_ACLS_SQL = `
select coalesce(json_object_agg(case defaclobjtype when 'r' then 'tables' when 'f' then 'functions' end, defaclacl::text), '{}'::json) as acls
from pg_default_acl where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype in ('r', 'f')
`
