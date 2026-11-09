// Reinicia la base LOCAL con los permisos por defecto de producción: en el Supabase actual, los objetos nuevos de `public` no le dan
// ningún permiso de datos a anon, authenticated ni service_role, y el stack local sí (concede todo). Con la base local así, un objeto
// sin GRANT explícito falla en los tests y no recién en producción. Solo toca la base local. Uso: npm run db:reset:parity
//
// Pasos: se reinicia la base hasta la primera migración (deja el resto, como storage, limpio), se vacía el esquema `public` y el historial
// de migraciones, se fijan los permisos por defecto de producción, se cargan los secretos de Vault de mentira que exige la migración del
// push (la clave y la URL de las funciones, que en local no existen), se aplican todas las migraciones y se desprograman los jobs de la app
// (el del push no tiene a quién llamar en local, y el de WhatsApp procesaría los eventos de los tests).
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { localDbUrl, psql } from './local-db.ts'
import { parseMigrationFileName } from './migrations-check.ts'

const MIGRATIONS_DIR = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
const PUSH_SECRET = 'cale_push_job_secret'
const FUNCTIONS_URL_SECRET = 'cale_functions_base_url'
const FAKE_SECRET_LENGTH = 40
const LOCAL_FUNCTIONS_URL = 'http://127.0.0.1:55321/functions/v1'

// Idéntico a pg_default_acl de producción para `postgres` en `public`: tablas con TRUNCATE, REFERENCES, TRIGGER y MAINTAIN para los
// tres roles, funciones sin permisos propios para esos roles. Lo controla un test contra PRODUCTION_DEFAULT_ACLS.
const PRODUCTION_DEFAULTS_SQL = `
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant truncate, references, trigger, maintain on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, service_role;
`

localDbUrl() // se niega a seguir si la base no es local, antes de tocar nada

const EMPTY_PUBLIC_SQL = `
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
delete from supabase_migrations.schema_migrations;
`

const supabase = (...args: string[]) => execFileSync('supabase', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })

const firstVersion = readdirSync(MIGRATIONS_DIR).flatMap(file => parseMigrationFileName(file)?.version ?? []).sort()[0]!
supabase('db', 'reset', '--version', firstVersion)
psql(EMPTY_PUBLIC_SQL)
psql(PRODUCTION_DEFAULTS_SQL)
psql(`select vault.create_secret(repeat('x', ${FAKE_SECRET_LENGTH}), '${PUSH_SECRET}', 'local test only') where not exists (select 1 from vault.secrets where name = '${PUSH_SECRET}')`)
psql(`select vault.create_secret('${LOCAL_FUNCTIONS_URL}', '${FUNCTIONS_URL_SECRET}', 'local test only') where not exists (select 1 from vault.secrets where name = '${FUNCTIONS_URL_SECRET}')`)
supabase('migration', 'up')
// Los jobs de la app no corren en local: el del push no tiene funciones a las que llamar y el de WhatsApp procesaría los eventos de los tests a mitad de camino
psql("select cron.unschedule(jobid) from cron.job where jobname like 'cale-%'")
console.log('✓ Base local reiniciada con los permisos por defecto de producción.')
