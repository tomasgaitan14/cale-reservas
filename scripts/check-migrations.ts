// Verifica las migraciones de Supabase (ver docs/migrations.md). Solo lee: nunca aplica nada.
//   npm run check:migrations           → controla los archivos de supabase/migrations
//   npm run check:migrations -- --remote → además los compara con el historial del proyecto remoto
// Para --remote hace falta SUPABASE_PROJECT_REF (el ref del proyecto de Supabase) y la CLI de Supabase con sesión iniciada.
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assertProjectRef, checkLocalFiles, compareWithRemote, hasRemoteProblems, MigrationCheckError, parseRemoteMigrations } from './migrations-check.ts'

const MIGRATIONS_DIR = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
const REMOTE_HISTORY_QUERY = 'select version, name from supabase_migrations.schema_migrations order by version'
const REMOTE_FLAG = '--remote'
const EXIT_PROBLEMS = 1

function readRemoteHistory(projectRef: string): string {
  try {
    return execFileSync('supabase', ['db', 'query', '--linked', '--project-ref', projectRef, REMOTE_HISTORY_QUERY], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    // La CLI responde con un JSON de error en stdout: parseRemoteMigrations lo convierte en un mensaje claro
    const stdout = (error as { stdout?: string }).stdout
    if (stdout) return stdout
    throw new MigrationCheckError('No se pudo ejecutar la CLI de Supabase (¿está instalada y con sesión iniciada?).')
  }
}

function main(): number {
  const local = checkLocalFiles(readdirSync(MIGRATIONS_DIR))
  const problems = [...local.problems]
  console.log(`Migraciones locales: ${local.migrations.length}`)

  if (process.argv.includes(REMOTE_FLAG)) {
    const remote = parseRemoteMigrations(readRemoteHistory(assertProjectRef(process.env.SUPABASE_PROJECT_REF)))
    const comparison = compareWithRemote(local.migrations, remote)
    console.log(`Migraciones aplicadas en el remoto: ${remote.length}`)
    for (const migration of comparison.missingLocally) {
      problems.push(`Aplicada en el remoto y sin archivo acá: ${migration.version}_${migration.name}. Hay que crear su archivo en supabase/migrations.`)
    }
    for (const item of comparison.renamed) problems.push(`La versión ${item.version} se llama "${item.local}" acá y "${item.remote}" en el remoto.`)
    for (const migration of comparison.pending) console.log(`Pendiente de aplicar (solo informativo): ${migration.version}_${migration.name}`)
    if (!hasRemoteProblems(comparison)) console.log('El historial remoto coincide con los archivos.')
  }

  for (const problem of problems) console.error(`✗ ${problem}`)
  if (problems.length === 0) console.log('✓ Migraciones en orden.')
  return problems.length === 0 ? 0 : EXIT_PROBLEMS
}

try {
  process.exitCode = main()
} catch (error) {
  if (!(error instanceof MigrationCheckError)) throw error
  console.error(`✗ ${error.message}`)
  process.exitCode = EXIT_PROBLEMS
}
