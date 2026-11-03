import { execFileSync } from 'node:child_process'

export interface LocalStack {
  apiUrl: string
  anonKey: string
  serviceRoleKey: string
}

const STATUS_LINE = /^([A-Z_]+)="?(.*?)"?$/

let cachedStack: LocalStack | undefined

function readStatus(): string {
  try {
    return execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    throw new Error('No se pudo leer `supabase status`: ¿está Docker abierto y corriendo `supabase start`?', { cause: error })
  }
}

// Las claves del stack local son las de demo de Supabase y cambian con cada instalación: se leen en vez de copiarlas al repo
export function localStack(): LocalStack {
  if (cachedStack) return cachedStack

  const values = new Map<string, string>()
  for (const line of readStatus().split('\n')) {
    const match = STATUS_LINE.exec(line.trim())
    if (match?.[1] && match[2] !== undefined) values.set(match[1], match[2])
  }

  const read = (name: string): string => {
    const value = values.get(name)
    if (!value) throw new Error(`\`supabase status\` no devolvió ${name}`)
    return value
  }
  cachedStack = { apiUrl: read('API_URL'), anonKey: read('ANON_KEY'), serviceRoleKey: read('SERVICE_ROLE_KEY') }
  return cachedStack
}
