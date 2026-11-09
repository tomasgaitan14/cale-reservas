// El job del push (cron) llama a la Edge Function push-delivery del PROPIO proyecto: la URL sale de Vault y no está escrita en la migración.
// Contexto: la migración original traía la URL de producción fija y en cale-dev el job llamó a producción.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'supabase', 'migrations')
const ORIGINAL = '20261104142607_schedule_push_delivery.sql'
const CORRECTIVE = '20261109200000_push_job_url_from_vault.sql'
const JOB_NAME = 'cale-push-delivery'
const URL_SECRET = 'cale_functions_base_url'
const URL_GUARD_ERROR = 'configure_cale_functions_base_url_first'
const PUSH_GUARD_ERROR = 'configure_cale_push_job_secret_first'

const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
const jobCommand = (sql: string) => /\$job\$([\s\S]*?)\$job\$/.exec(sql)?.[1]?.trim()
const stripComments = (sql: string) => sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')

describe.each([ORIGINAL, CORRECTIVE])('job del push en %s', file => {
  const sql = read(file)
  const code = stripComments(sql)

  it('programa el job por su nombre', () => {
    expect(code).toContain(`cron.schedule('${JOB_NAME}'`)
  })
  it('toma la URL de las funciones de Vault y no la lleva escrita', () => {
    expect(jobCommand(sql)).toMatch(new RegExp(`url:=\\(select decrypted_secret from vault\\.decrypted_secrets where name='${URL_SECRET}'\\)\\|\\|'/push-delivery'`))
    expect(code).not.toMatch(/https?:\/\/[a-z0-9.-]+\.supabase\.(co|in)/i)
    expect(code).not.toMatch(/url:='https?:/)
  })
  it('falla a propósito si falta la URL o la clave en Vault', () => {
    expect(code).toContain(URL_GUARD_ERROR)
    expect(code).toContain(PUSH_GUARD_ERROR)
    expect(code).toMatch(new RegExp(`name='${URL_SECRET}' and decrypted_secret ~ '\\^https\\?:\\/\\/\\[\\^\\/\\]\\+\\/functions\\/v1\\$'`))
  })
})

describe('migración correctiva del job del push', () => {
  it('es posterior a la original', () => {
    expect(CORRECTIVE.slice(0, 14) > ORIGINAL.slice(0, 14)).toBe(true)
  })
  it('deja el mismo comando que la original, para que un proyecto nuevo y uno ya migrado terminen igual', () => {
    expect(jobCommand(read(CORRECTIVE))).toBeDefined()
    expect(jobCommand(read(CORRECTIVE))).toBe(jobCommand(read(ORIGINAL)))
  })
  it('sigue mandando la clave del job desde Vault', () => {
    expect(jobCommand(read(CORRECTIVE))).toContain("'x-push-job-secret',(select decrypted_secret from vault.decrypted_secrets where name='cale_push_job_secret')")
  })
})
