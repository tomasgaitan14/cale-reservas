// Reglas de las migraciones de Supabase: este repo es la única fuente de verdad (ver docs/migrations.md).
// Dos controles: los archivos locales (nombres bien formados, sin versiones ni nombres repetidos) y la comparación con el
// historial del proyecto remoto (nada aplicado sin archivo, ningún nombre distinto). Lógica pura: el acceso al disco y a la
// CLI está en check-migrations.ts, para probarla sin tocar ningún entorno.

export interface Migration {
  version: string
  name: string
}

export class MigrationCheckError extends Error {
  override name = 'MigrationCheckError'
}

// <versión de 14 dígitos>_<nombre en minúsculas con guiones bajos>.sql: el formato que exige la CLI de Supabase
export const MIGRATION_FILE_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/
const PROJECT_REF_PATTERN = /^[a-z]{20}$/

export function parseMigrationFileName(fileName: string): Migration | null {
  const match = MIGRATION_FILE_PATTERN.exec(fileName)
  if (!match) return null
  return { version: match[1]!, name: match[2]! }
}

// El ref va como argumento de la CLI: se valida para que no pueda colarse una opción ("--algo")
export function assertProjectRef(ref: string | undefined): string {
  if (!ref || !PROJECT_REF_PATTERN.test(ref)) {
    throw new MigrationCheckError('SUPABASE_PROJECT_REF tiene que ser el ref del proyecto (20 letras minúsculas).')
  }
  return ref
}

export interface LocalCheck {
  migrations: Migration[]
  problems: string[]
}

export function checkLocalFiles(fileNames: readonly string[]): LocalCheck {
  const migrations: Migration[] = []
  const problems: string[] = []
  const versions = new Map<string, string>()
  const names = new Map<string, string>()
  // Los archivos ocultos (.DS_Store) no son migraciones ni un error
  for (const fileName of fileNames.filter(file => !file.startsWith('.')).sort()) {
    const migration = parseMigrationFileName(fileName)
    if (!migration) {
      problems.push(`"${fileName}" no es una migración válida (<14 dígitos>_<nombre_en_minúsculas>.sql).`)
      continue
    }
    const sameVersion = versions.get(migration.version)
    if (sameVersion) problems.push(`Versión repetida ${migration.version}: "${sameVersion}" y "${fileName}".`)
    const sameName = names.get(migration.name)
    if (sameName) problems.push(`Nombre repetido "${migration.name}": "${sameName}" y "${fileName}".`)
    versions.set(migration.version, fileName)
    names.set(migration.name, fileName)
    migrations.push(migration)
  }
  return { migrations, problems }
}

export interface RemoteComparison {
  // Aplicadas en el remoto sin archivo acá: el descuadre que este control existe para detectar
  missingLocally: Migration[]
  // Con archivo acá y todavía sin aplicar: es lo normal antes de un deploy, solo se informa
  pending: Migration[]
  renamed: { version: string; local: string; remote: string }[]
}

export function compareWithRemote(local: readonly Migration[], remote: readonly Migration[]): RemoteComparison {
  const localByVersion = new Map(local.map(migration => [migration.version, migration]))
  const remoteByVersion = new Map(remote.map(migration => [migration.version, migration]))
  return {
    missingLocally: remote.filter(migration => !localByVersion.has(migration.version)),
    pending: local.filter(migration => !remoteByVersion.has(migration.version)),
    renamed: local.flatMap(migration => {
      const applied = remoteByVersion.get(migration.version)
      return applied && applied.name !== migration.name ? [{ version: migration.version, local: migration.name, remote: applied.name }] : []
    }),
  }
}

export function hasRemoteProblems(comparison: RemoteComparison): boolean {
  return comparison.missingLocally.length > 0 || comparison.renamed.length > 0
}

// Salida de `supabase db query --linked`: un JSON con "rows" (y avisos); los errores llegan como { _tag: 'Error', error }.
export function parseQueryRows(output: string): unknown[] {
  const notJson = new MigrationCheckError('La CLI de Supabase no devolvió un JSON.')
  const start = output.indexOf('{')
  if (start < 0) throw notJson
  let parsed: unknown
  try {
    parsed = JSON.parse(output.slice(start))
  } catch {
    throw notJson
  }
  if (parsed === null || typeof parsed !== 'object') throw notJson
  const body = parsed as { _tag?: unknown; error?: { code?: unknown; message?: unknown }; rows?: unknown }
  if (body._tag === 'Error') {
    throw new MigrationCheckError(`La CLI de Supabase falló: ${String(body.error?.code ?? 'sin código')}: ${String(body.error?.message ?? '')}`.trim())
  }
  if (!Array.isArray(body.rows)) throw new MigrationCheckError('La respuesta de Supabase no trae "rows".')
  return body.rows
}

export function parseRemoteMigrations(output: string): Migration[] {
  return parseQueryRows(output).map(row => {
    const { version, name } = (row ?? {}) as { version?: unknown; name?: unknown }
    if (typeof version !== 'string' || typeof name !== 'string') throw new MigrationCheckError('Una fila del historial remoto no trae version y name.')
    return { version, name }
  })
}
