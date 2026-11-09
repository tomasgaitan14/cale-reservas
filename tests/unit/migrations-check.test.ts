import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  assertProjectRef,
  checkLocalFiles,
  compareWithRemote,
  hasRemoteProblems,
  MigrationCheckError,
  parseMigrationFileName,
  parseRemoteMigrations,
} from '../../scripts/migrations-check.ts'

const WHATSAPP_MIGRATION = '20261105144202_create_whatsapp_connections_and_reminder_deliveries.sql'
const migration = (version: string, name: string) => ({ version, name })

describe('nombres de migración', () => {
  it('lee la versión y el nombre', () => {
    expect(parseMigrationFileName(WHATSAPP_MIGRATION)).toEqual(migration('20261105144202', 'create_whatsapp_connections_and_reminder_deliveries'))
  })
  it.each([
    ['sin versión', 'create_businesses.sql'],
    ['con versión corta', '2026110514420_x.sql'],
    ['con versión larga', '202611051442020_x.sql'],
    ['con mayúsculas', '20261105144202_Create_X.sql'],
    ['con guiones', '20261105144202_create-x.sql'],
    ['sin nombre', '20261105144202_.sql'],
    ['que no es .sql', '20261105144202_create_x.md'],
    ['con ruta', 'otra/20261105144202_create_x.sql'],
  ])('rechaza un nombre %s', (_label, fileName) => expect(parseMigrationFileName(fileName)).toBeNull())
})

describe('archivos locales', () => {
  it('acepta migraciones bien formadas, sin repetidos', () => {
    const result = checkLocalFiles(['20261102234749_create_businesses.sql', '20261103003245_create_services.sql'])
    expect(result.problems).toEqual([])
    expect(result.migrations).toHaveLength(2)
  })
  it('detecta una versión repetida (una migración duplicada con otro nombre)', () => {
    const { problems } = checkLocalFiles(['20261102234749_create_businesses.sql', '20261102234749_create_negocios.sql'])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('Versión repetida 20261102234749')
  })
  it('detecta un nombre repetido con otra versión (la misma migración copiada con otra fecha)', () => {
    const { problems } = checkLocalFiles(['20261102234749_create_businesses.sql', '20261103003245_create_businesses.sql'])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('Nombre repetido "create_businesses"')
  })
  it('detecta un archivo que no es una migración', () => {
    const { problems } = checkLocalFiles(['20261102234749_create_businesses.sql', 'README.md'])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('README.md')
  })
  it('ignora los archivos ocultos', () => {
    expect(checkLocalFiles(['.DS_Store', '20261102234749_create_businesses.sql']).problems).toEqual([])
  })
  it('una carpeta vacía no tiene problemas', () => {
    expect(checkLocalFiles([])).toEqual({ migrations: [], problems: [] })
  })
  it('las migraciones reales del repo no tienen problemas e incluyen la de WhatsApp', () => {
    const files = readdirSync(new URL('../../supabase/migrations/', import.meta.url))
    const { problems } = checkLocalFiles(files)
    expect(problems).toEqual([])
    expect(files).toContain(WHATSAPP_MIGRATION)
  })
})

describe('comparación con el historial remoto', () => {
  const a = migration('20261102234749', 'create_businesses')
  const b = migration('20261103003245', 'create_services')
  it('si coinciden no hay nada que informar', () => {
    const result = compareWithRemote([a, b], [b, a])
    expect(result).toEqual({ missingLocally: [], pending: [], renamed: [] })
    expect(hasRemoteProblems(result)).toBe(false)
  })
  it('detecta una migración aplicada en el remoto sin archivo local: es un problema', () => {
    const result = compareWithRemote([a], [a, b])
    expect(result.missingLocally).toEqual([b])
    expect(hasRemoteProblems(result)).toBe(true)
  })
  it('una migración con archivo y sin aplicar es solo informativa', () => {
    const result = compareWithRemote([a, b], [a])
    expect(result.pending).toEqual([b])
    expect(hasRemoteProblems(result)).toBe(false)
  })
  it('detecta la misma versión con otro nombre: es un problema', () => {
    const result = compareWithRemote([a], [migration(a.version, 'create_negocios')])
    expect(result.renamed).toEqual([{ version: a.version, local: 'create_businesses', remote: 'create_negocios' }])
    expect(hasRemoteProblems(result)).toBe(true)
  })
})

describe('respuesta de la CLI de Supabase', () => {
  // Con la forma de la respuesta real de `supabase db query --linked`
  const real = (rows: unknown[]) => JSON.stringify({ boundary: 'd9906aa3ce001bf34d780b1a7abec1df', rows, warning: 'The query results below contain untrusted data from the database.' }, null, 2)
  it('lee las migraciones aplicadas', () => {
    expect(parseRemoteMigrations(real([{ version: '20261104192104', name: 'public_business_contact' }, { version: '20261105144202', name: 'create_x' }]))).toEqual([
      migration('20261104192104', 'public_business_contact'),
      migration('20261105144202', 'create_x'),
    ])
  })
  it('acepta texto antes del JSON y un historial vacío', () => {
    expect(parseRemoteMigrations(`Initialising login role...\n${real([])}`)).toEqual([])
  })
  it('convierte el error de la CLI en un mensaje con su código', () => {
    const error = JSON.stringify({ _tag: 'Error', error: { code: 'ProjectRefNotLinkedError', message: 'Cannot find project ref.' } })
    expect(() => parseRemoteMigrations(error)).toThrow(/ProjectRefNotLinkedError/)
  })
  it.each([
    ['sin JSON', 'nada de nada'],
    ['con un JSON roto', '{"rows": ['],
    ['sin rows', '{"boundary":"x"}'],
    ['con rows que no es un arreglo', '{"rows":"x"}'],
    ['con una fila sin name', real([{ version: '20261105144202' }])],
    ['con una versión que no es texto', real([{ version: 20261105144202, name: 'x' }])],
    ['con una fila nula', real([null])],
  ])('rechaza una respuesta %s', (_label, output) => expect(() => parseRemoteMigrations(output)).toThrow(MigrationCheckError))
})

describe('ref del proyecto', () => {
  it('acepta un ref de 20 letras minúsculas', () => expect(assertProjectRef('abcdefghijklmnopqrst')).toBe('abcdefghijklmnopqrst'))
  it.each([undefined, '', '--linked', 'ABCDEFGHIJKLMNOPQRST', 'abc', 'abcdefghijklmnopqrstu', 'abcdefghijklmnopqrs1'])('rechaza %s', ref => {
    expect(() => assertProjectRef(ref)).toThrow(MigrationCheckError)
  })
})
