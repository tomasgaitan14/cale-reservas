// Compara los permisos de `public` con el manifiesto supabase/privileges.json. Solo lee: nunca cambia nada.
//   npm run check:privileges                    → contra la base local (hay que reiniciarla con `npm run db:reset:parity`)
//   SUPABASE_PROJECT_REF=<ref> npm run check:privileges -- --remote   → contra el proyecto remoto
//   npm run check:privileges -- --update        → reescribe el manifiesto desde la base local (después de revisar el cambio)
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { psql } from './local-db.ts'
import { assertProjectRef, MigrationCheckError } from './migrations-check.ts'
import { AUDIT_SQL, comparePrivileges, hasPrivilegeProblems, parseAuditLines, parseRemoteAudit, type Manifest } from './privileges-check.ts'

const MANIFEST_PATH = fileURLToPath(new URL('../supabase/privileges.json', import.meta.url))
const EXIT_PROBLEMS = 1

const readManifest = (): Manifest => JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest

function readRemoteAudit(projectRef: string): string[] {
  try {
    return parseRemoteAudit(execFileSync('supabase', ['db', 'query', '--linked', '--project-ref', projectRef, AUDIT_SQL], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout
    if (stdout) return parseRemoteAudit(stdout)
    throw new MigrationCheckError('No se pudo ejecutar la CLI de Supabase (¿está instalada y con sesión iniciada?).')
  }
}

const readLocalAudit = (): string[] => parseAuditLines([{ lines: psql(AUDIT_SQL) }])

function main(): number {
  const manifest = readManifest()
  if (process.argv.includes('--update')) {
    const ignored = new Set(Object.keys(manifest.ignored))
    const objects = readLocalAudit().filter(line => !ignored.has(line.split(' | ')[0] ?? line))
    writeFileSync(MANIFEST_PATH, `${JSON.stringify({ ...manifest, objects }, null, 2)}\n`)
    console.log(`✓ Manifiesto actualizado: ${objects.length} objetos. Revisá el cambio con git diff antes de commitear.`)
    return 0
  }

  const remote = process.argv.includes('--remote')
  const actual = remote ? readRemoteAudit(assertProjectRef(process.env.SUPABASE_PROJECT_REF)) : readLocalAudit()
  const comparison = comparePrivileges(manifest, actual)
  console.log(`Permisos ${remote ? 'del remoto' : 'locales'}: ${actual.length} objetos; manifiesto: ${manifest.objects.length}.`)
  for (const name of comparison.missing) console.log(`Falta en la base (¿migración sin aplicar?, solo informativo): ${name}`)
  for (const item of comparison.different) console.error(`✗ ${item.name}\n    esperado: ${item.expected}\n    real:     ${item.actual}`)
  for (const name of comparison.unexpected) console.error(`✗ Existe en la base y no está en el manifiesto: ${name}`)
  if (!hasPrivilegeProblems(comparison)) console.log('✓ Los permisos coinciden con el manifiesto.')
  return hasPrivilegeProblems(comparison) ? EXIT_PROBLEMS : 0
}

try {
  process.exitCode = main()
} catch (error) {
  if (!(error instanceof MigrationCheckError)) throw error
  console.error(`✗ ${error.message}`)
  process.exitCode = EXIT_PROBLEMS
}
