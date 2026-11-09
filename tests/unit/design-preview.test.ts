import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesignPreview } from '../../app/src/designs/DesignPreview.tsx'
import { Brand } from '../../app/src/components/Brand.tsx'
import { DESIGN_VARIANTS } from '../../app/src/designs/model.ts'
afterEach(()=>vi.unstubAllGlobals())
function render(variant:typeof DESIGN_VARIANTS[number],search:string) {
  vi.stubGlobal('window',{location:{search,origin:'http://127.0.0.1:5174'}})
  return renderToStaticMarkup(createElement(DesignPreview,{variant}))
}
describe('propuestas comparables',()=>{
  it.each(DESIGN_VARIANTS)('%s conserva el logo original y los mismos cuatro turnos',variant=>{
    const html=render(variant,'?vista=agenda')
    expect(html).toContain(renderToStaticMarkup(createElement(Brand)))
    expect(html).toContain('Tu día, en orden.')
    for(const time of ['09:00','10:30','14:00','16:00']) expect(html).toContain(time)
    expect(html).toContain('Datos de demostración')
    expect(html).toContain('Nuevo turno')
    expect(html).toContain('Bloquear horario')
  })
  it.each(DESIGN_VARIANTS)('%s permite revisar la portada y la reserva sin cuenta',variant=>{
    const landing=render(variant,'?vista=portada')
    expect(landing).toContain('Reservas y recordatorios de turnos,')
    expect(landing).toContain('Empezá Gratis')
    expect(landing).toContain('No crea una reserva real')
    const booking=render(variant,'?vista=reserva')
    expect(booking).toContain('Un turno que te quede bien.')
    expect(booking).toContain('Servicio')
    expect(booking).toContain('Tus datos')
  })
  it('la vista embebida no repite las herramientas de revisión dentro del celular',()=>{
    const html=render('natural','?vista=reserva&embed=1')
    expect(html).not.toContain('Diseños de Cale')
    expect(html).toContain('Reservas online · demostración')
  })
})
