import { describe, expect, it } from 'vitest'
import { MigrationCheckError } from '../../scripts/migrations-check.ts'
import { comparePrivileges, hasPrivilegeProblems, parseAuditLines, parseRemoteAudit, type Manifest } from '../../scripts/privileges-check.ts'

const TABLE_A = 'table whatsapp_connections | rls=true | anon=- | authenticated=- | service_role=SELECT,INSERT,UPDATE,DELETE'
const TABLE_A_WITHOUT_SERVER = 'table whatsapp_connections | rls=true | anon=- | authenticated=- | service_role=-'
const FUNCTION_B = 'function create_booking(p_slug text) | definer=true | anon=false | authenticated=false | service_role=true'
const PLATFORM = 'function rls_auto_enable() | definer=true | anon=true | authenticated=true | service_role=true'

const manifest = (...objects: string[]): Manifest => ({ ignored: { 'function rls_auto_enable()': 'platform' }, objects })

describe('comparación de permisos con el manifiesto', () => {
  it('si coinciden no hay nada que informar', () => {
    const result = comparePrivileges(manifest(TABLE_A, FUNCTION_B), [FUNCTION_B, TABLE_A])
    expect(result).toEqual({ different: [], unexpected: [], missing: [] })
    expect(hasPrivilegeProblems(result)).toBe(false)
  })

  it('detecta una tabla a la que le falta el permiso del servidor: la diferencia local contra producción que motivó esto', () => {
    const result = comparePrivileges(manifest(TABLE_A), [TABLE_A_WITHOUT_SERVER])
    expect(result.different).toEqual([{ name: 'table whatsapp_connections', expected: TABLE_A, actual: TABLE_A_WITHOUT_SERVER }])
    expect(hasPrivilegeProblems(result)).toBe(true)
  })

  it('detecta un permiso de más (por ejemplo, una función ejecutable por anon)', () => {
    const open = FUNCTION_B.replace('anon=false', 'anon=true')
    expect(hasPrivilegeProblems(comparePrivileges(manifest(FUNCTION_B), [open]))).toBe(true)
  })

  it('un objeto que existe y el manifiesto no conoce es un problema', () => {
    const result = comparePrivileges(manifest(TABLE_A), [TABLE_A, FUNCTION_B])
    expect(result.unexpected).toEqual(['function create_booking(p_slug text)'])
    expect(hasPrivilegeProblems(result)).toBe(true)
  })

  it('un objeto del manifiesto que todavía no existe (migración sin aplicar) solo se informa', () => {
    const result = comparePrivileges(manifest(TABLE_A, FUNCTION_B), [TABLE_A])
    expect(result.missing).toEqual(['function create_booking(p_slug text)'])
    expect(hasPrivilegeProblems(result)).toBe(false)
  })

  it('los objetos de la plataforma ignorados no cuentan, estén o no', () => {
    expect(comparePrivileges(manifest(TABLE_A), [TABLE_A, PLATFORM])).toEqual({ different: [], unexpected: [], missing: [] })
    expect(comparePrivileges(manifest(TABLE_A), [TABLE_A])).toEqual({ different: [], unexpected: [], missing: [] })
  })
})

describe('lectura de la auditoría', () => {
  const lines = [TABLE_A, FUNCTION_B]

  it('lee la lista de líneas, venga como arreglo o como texto JSON', () => {
    expect(parseAuditLines([{ lines }])).toEqual(lines)
    expect(parseAuditLines([{ lines: JSON.stringify(lines) }])).toEqual(lines)
  })

  it('lee la respuesta real de la CLI de Supabase', () => {
    const output = JSON.stringify({ boundary: 'abc', rows: [{ lines }], warning: 'The query results below contain untrusted data.' }, null, 2)
    expect(parseRemoteAudit(`Initialising login role...\n${output}`)).toEqual(lines)
  })

  it.each([
    ['sin filas', []],
    ['sin lines', [{}]],
    ['con lines que no es una lista', [{ lines: 'esto no es JSON' }]],
    ['con una línea que no es texto', [{ lines: [1, 2] }]],
  ])('rechaza una auditoría %s', (_label, rows) => {
    expect(() => parseAuditLines(rows as unknown[])).toThrow()
  })

  it('el error de la CLI se informa con su código', () => {
    const error = JSON.stringify({ _tag: 'Error', error: { code: 'ProjectRefNotLinkedError', message: 'Cannot find project ref.' } })
    expect(() => parseRemoteAudit(error)).toThrow(MigrationCheckError)
  })
})
