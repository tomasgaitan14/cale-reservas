import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adminClient } from '../support/users.ts'
import { psql, psqlSession } from '../support/psql.ts'
import {
  cleanUpTestEvents,
  daysAgo,
  eventsOf,
  ingest,
  newMetaIds,
  newWamid,
  singleEvent,
  statusItem,
} from '../support/whatsapp-events.ts'
import { afterAll, beforeAll } from 'vitest'

const MIGRATION = readFileSync(new URL('../../supabase/migrations/20261105170000_schedule_whatsapp_events_jobs.sql', import.meta.url), 'utf8')

const PROCESS_JOB = { jobname: 'cale-whatsapp-events-process', schedule: '* * * * *', command: 'call public.process_whatsapp_events(100)', active: true }
const PURGE_JOB = { jobname: 'cale-whatsapp-events-purge', schedule: '0 6 * * *', command: 'select public.purge_whatsapp_webhook_events()', active: true }

const JOBS_QUERY = `select coalesce(json_agg(j order by jobname), '[]'::json) from (select jobname, schedule, command, active from cron.job where jobname like 'cale-whatsapp-events-%') j`
// Aplica la migración en una transacción que se deshace: no deja ningún job en la base local
const jobsAfter = (applications: number): { jobname: string; schedule: string; command: string; active: boolean }[] => {
  const output = psqlSession(['begin', ...Array.from({ length: applications }, () => MIGRATION), JOBS_QUERY, 'rollback'])
  return JSON.parse(output.split('\n').at(-1)!)
}

// Los comandos tal como están escritos en la migración: lo que de verdad va a correr pg_cron
const scheduledCommands = [...MIGRATION.matchAll(/\$job\$(.*?)\$job\$/gs)].map(match => match[1]!.trim())

beforeAll(cleanUpTestEvents)
afterAll(cleanUpTestEvents)

describe('jobs de pg_cron de la bandeja de WhatsApp', () => {
  it('la migración programa exactamente dos jobs: el procesador cada minuto y la purga una vez por día', () => {
    expect(jobsAfter(1)).toEqual([PROCESS_JOB, PURGE_JOB])
  })

  it('aplicarla más de una vez no duplica los jobs', () => {
    expect(jobsAfter(3)).toEqual([PROCESS_JOB, PURGE_JOB])
  })

  it('no programa nada más ni llama a ninguna URL', () => {
    expect(MIGRATION.match(/cron\.schedule\(/g)).toHaveLength(2)
    expect(scheduledCommands).toEqual([PROCESS_JOB.command, PURGE_JOB.command])
    expect(MIGRATION).not.toMatch(/net\.http_post|vault\./)
  })

  it('si todavía no se aplicó la migración de la bandeja, falla y no programa nada', () => {
    const attempt = () =>
      psqlSession([
        'begin',
        'alter procedure public.process_whatsapp_events(integer) rename to process_whatsapp_events_tmp',
        MIGRATION,
        JOBS_QUERY,
        'rollback',
      ])
    expect(attempt).toThrow(/apply_the_whatsapp_webhook_events_migration_first/)
    // La sesión murió con error: nada quedó a medias
    expect(psql(`select count(*) from cron.job where jobname like 'cale-whatsapp-events-%'`)).toBe('0')
    expect(psql(`select to_regprocedure('public.process_whatsapp_events(integer)') is not null`)).toBe('t')
  })

  it('la base local de los tests no tiene ningún job de la app: no procesan eventos a mitad de un test', () => {
    expect(psql(`select count(*) from cron.job where jobname like 'cale-%'`)).toBe('0')
  })

  it('el comando del procesador, tal como está en la migración, procesa un evento pendiente', async () => {
    const wamid = newWamid()
    await ingest([statusItem({ wamid, status: 'sent', connection: newMetaIds() })])
    expect((await singleEvent(wamid)).attempts).toBe(0)

    psql(scheduledCommands[0]!)

    // Sin conexión asociada el evento queda esperando, con un intento: lo tomó y lo procesó
    expect(await singleEvent(wamid)).toMatchObject({ process_status: 'pending', result_code: 'waiting_connection', attempts: 1 })
  })

  it('el comando de la purga, tal como está en la migración, borra lo vencido y conserva lo reciente', async () => {
    const client = adminClient()
    const row = async (days: number) => {
      const wamid = newWamid()
      const { error } = await client.from('whatsapp_webhook_events').insert({
        event_key: `jobs:${wamid}`,
        kind: 'status',
        phone_number_id: '1',
        meta_message_id: wamid,
        status_value: 'sent',
        payload: {},
        process_status: 'processed',
        processed_at: daysAgo(days),
      })
      expect(error).toBeNull()
      return wamid
    }
    const old = await row(400)
    const recent = await row(1)

    psql(scheduledCommands[1]!)

    expect(await eventsOf(old)).toHaveLength(0)
    expect(await eventsOf(recent)).toHaveLength(1)
  })
})
