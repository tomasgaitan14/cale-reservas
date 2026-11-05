// Acceso a la base LOCAL de Supabase (la del stack de Docker) desde los scripts. Se niega a trabajar con cualquier otra.
import { execFileSync } from 'node:child_process'
import { MigrationCheckError } from './migrations-check.ts'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])
const STATUS_LINE = /^([A-Z_]+)="?(.*?)"?$/

export function localDbUrl(): string {
  let output: string
  try {
    output = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    throw new MigrationCheckError('No se pudo leer `supabase status`: ¿está Docker abierto y corriendo `supabase start`?')
  }
  const url = output.split('\n').map(line => STATUS_LINE.exec(line.trim())).find(match => match?.[1] === 'DB_URL')?.[2]
  if (!url || !LOCAL_HOSTS.has(new URL(url).hostname)) throw new MigrationCheckError('La base del stack no es local: este script no trabaja con ella.')
  return url
}

export function psql(sql: string): string {
  return execFileSync('psql', [localDbUrl(), '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
