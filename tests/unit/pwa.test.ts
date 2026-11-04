import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const manifest = JSON.parse(readFileSync('app/public/manifest.webmanifest', 'utf8'))
describe('PWA del panel', () => {
  it('abre el panel como app y conserva una identidad estable', () => {
    expect(manifest).toMatchObject({ id: '/panel', name: 'Cale', short_name: 'Cale', start_url: '/panel', scope: '/panel', display: 'standalone' })
  })
  it('los iconos declarados existen con sus dimensiones PNG reales', () => {
    for (const icon of manifest.icons) {
      const bytes = readFileSync(`app/public${icon.src}`)
      const size = Number(icon.sizes.split('x')[0])
      expect(bytes.readUInt32BE(16)).toBe(size)
      expect(bytes.readUInt32BE(20)).toBe(size)
    }
  })
})
