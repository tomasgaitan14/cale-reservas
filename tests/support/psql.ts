import { execFileSync } from 'node:child_process'
import { localStack } from './stack.ts'

// Ejecuta SQL directo contra la base local y devuelve la salida cruda (para llamar procedimientos y leer el catálogo)
export function psql(sql: string): string {
  return execFileSync('psql', [localStack().dbUrl, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

// Ejecuta varias sentencias en una misma sesión (cada una como un -c), para probar dentro de una transacción que después se deshace
export function psqlSession(statements: string[]): string {
  const args = statements.flatMap(statement => ['-c', statement])
  return execFileSync('psql', [localStack().dbUrl, '-v', 'ON_ERROR_STOP=1', '-qAt', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
