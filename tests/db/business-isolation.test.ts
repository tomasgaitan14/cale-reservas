import { describe, expect, it } from 'vitest'
import { createBusiness, SAMPLE_WHATSAPP, tryCreateBusiness, uniqueSlug } from '../support/businesses.ts'
import { adminClient, anonymousClient, currentUserId, newUserClient } from '../support/users.ts'

// Códigos de error de Postgres que devuelve la API
const INSUFFICIENT_PRIVILEGE = '42501'

describe('negocios', () => {
  it('un usuario crea un negocio y lo ve en su lista', async () => {
    const lucia = await newUserClient()
    const slug = uniqueSlug('lucero')

    const created = await lucia.rpc('create_business', {
      p_name: 'Peluquería Lucero',
      p_slug: slug,
      p_whatsapp: '5493445550101',
    })
    expect(created.error).toBeNull()

    const listed = await lucia.from('businesses').select('slug, name')
    expect(listed.error).toBeNull()
    expect(listed.data).toEqual([{ slug, name: 'Peluquería Lucero' }])
  })

  it('otro usuario con sesión no ve el negocio ajeno, ni en su lista ni buscándolo por slug', async () => {
    const lucia = await newUserClient()
    const mateo = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    const norte = await createBusiness(mateo, 'Estética del Norte', 'norte')

    const mateoList = await mateo.from('businesses').select('slug')
    expect(mateoList.error).toBeNull()
    expect(mateoList.data).toEqual([{ slug: norte.slug }])

    const mateoLookup = await mateo.from('businesses').select('slug').eq('slug', lucero.slug)
    expect(mateoLookup.error).toBeNull()
    expect(mateoLookup.data).toEqual([])
  })

  it('otro usuario no puede modificar ni borrar el negocio ajeno', async () => {
    const lucia = await newUserClient()
    const mateo = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')

    // La seguridad por filas no devuelve error: simplemente no toca ninguna fila
    const update = await mateo.from('businesses').update({ name: 'Cerrado por Mateo' }).eq('slug', lucero.slug).select('slug')
    expect(update.error).toBeNull()
    expect(update.data).toEqual([])

    const removal = await mateo.from('businesses').delete().eq('slug', lucero.slug).select('slug')
    expect(removal.error).toBeNull()
    expect(removal.data).toEqual([])

    const luciaView = await lucia.from('businesses').select('name').eq('slug', lucero.slug)
    expect(luciaView.data).toEqual([{ name: 'Peluquería Lucero' }])
  })

  it('un usuario no puede agregarse como miembro de un negocio ajeno', async () => {
    const lucia = await newUserClient()
    const mateo = await newUserClient()
    const lucero = await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    const luceroRow = await lucia.from('businesses').select('id').eq('slug', lucero.slug).single()
    expect(luceroRow.error).toBeNull()

    const join = await mateo.from('business_members').insert({
      business_id: luceroRow.data?.id,
      user_id: await currentUserId(mateo),
    })
    expect(join.error?.code).toBe(INSUFFICIENT_PRIVILEGE)

    const mateoView = await mateo.from('businesses').select('slug').eq('slug', lucero.slug)
    expect(mateoView.data).toEqual([])
  })

  it('otro usuario no ve quién es miembro de un negocio ajeno', async () => {
    const lucia = await newUserClient()
    const mateo = await newUserClient()
    await createBusiness(lucia, 'Peluquería Lucero', 'lucero')

    const members = await mateo.from('business_members').select('user_id')
    expect(members.error).toBeNull()
    expect(members.data).toEqual([])
  })

  it('sin sesión no se puede crear un negocio ni leer los existentes', async () => {
    const lucia = await newUserClient()
    await createBusiness(lucia, 'Peluquería Lucero', 'lucero')
    const visitor = anonymousClient()
    const attempted = uniqueSlug('visita')

    const created = await tryCreateBusiness(visitor, { name: 'Sin sesión', slug: attempted, whatsapp: SAMPLE_WHATSAPP })
    expect(created.error?.code).toBe(INSUFFICIENT_PRIVILEGE)
    const stored = await adminClient().from('businesses').select('slug').eq('slug', attempted)
    expect(stored.data).toEqual([])

    const businesses = await visitor.from('businesses').select('slug')
    expect(businesses.error).toBeNull()
    expect(businesses.data).toEqual([])

    const members = await visitor.from('business_members').select('user_id')
    expect(members.error).toBeNull()
    expect(members.data).toEqual([])
  })
})
