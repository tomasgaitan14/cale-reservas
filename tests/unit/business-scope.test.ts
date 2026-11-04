import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture=vi.hoisted(()=>({tables:{} as Record<string,Record<string,unknown>[]>,error:null as null | {message:string}}))
vi.mock('../../app/src/lib/supabase.ts',()=>({supabase:{from:(table:string)=>{
  let filters:((row:Record<string,unknown>)=>boolean)[]=[]
  let head=false
  const query={
    select:(_columns:string,options?:{head?:boolean})=>{head=options?.head??false;return query},
    eq:(key:string,value:unknown)=>{filters.push(row=>row[key]===value);return query},
    neq:(key:string,value:unknown)=>{filters.push(row=>row[key]!==value);return query},
    gte:(key:string,value:string)=>{filters.push(row=>String(row[key])>=value);return query},
    gt:(key:string,value:string)=>{filters.push(row=>String(row[key])>value);return query},
    lt:(key:string,value:string)=>{filters.push(row=>String(row[key])<value);return query},
    order:()=>query,
    then:(resolve:(value:unknown)=>unknown,reject?:(error:unknown)=>unknown)=>{
      const rows=(fixture.tables[table]??[]).filter(row=>filters.every(accept=>accept(row)))
      return Promise.resolve({data:head?null:rows,count:rows.length,error:fixture.error}).then(resolve,reject)
    },
  }
  return query
}}}))
import { fetchServices, ServiceLoadError } from '../../app/src/lib/services.ts'
import { fetchHours } from '../../app/src/lib/hours-api.ts'
import { fetchAgenda } from '../../app/src/lib/agenda-api.ts'
import { fetchSetupProgress } from '../../app/src/lib/setup.ts'
const NOW=new Date('2026-11-03T12:00:00Z')
beforeEach(()=>{
 fixture.error=null
 fixture.tables={
  services:[{id:'service-a',business_id:'a',name:'Servicio A',duration_minutes:60,active:true},{id:'service-b',business_id:'b',name:'Servicio B',duration_minutes:60,active:true}],
  working_hours:[{business_id:'b',day_of_week:1,start_time:'09:00:00',end_time:'18:00:00'}],
  appointments:[{id:'appointment-b',business_id:'b',status:'pending',starts_at:'2026-11-04T12:00:00.000Z',ends_at:'2026-11-04T13:00:00.000Z'}],
  time_blocks:[{id:'block-b',business_id:'b',starts_at:'2026-11-04T14:00:00.000Z',ends_at:'2026-11-04T15:00:00.000Z'}],
 }
})
describe('el panel lee solo el negocio abierto',()=>{
 it('los servicios de otro negocio de la misma cuenta no aparecen',async()=>{
  expect((await fetchServices('a')).map(item=>item.id)).toEqual(['service-a'])
 })
 it('los horarios ajenos no completan el paso del alta',async()=>{
  const hours=await fetchHours('a')
  expect(Object.values(hours).flat()).toHaveLength(0)
 })
 it('la agenda no mezcla turnos ni bloqueos de otro negocio',async()=>{
  expect(await fetchAgenda('a','2026-11-04','2026-11-04')).toEqual({appointments:[],blocks:[]})
 })
 it('el avance no usa horarios ni reservas de otro negocio',async()=>{
  expect(await fetchSetupProgress('a',NOW)).toEqual({serviceCount:1,hasHours:false,upcomingCount:0})
 })
 it('un rechazo de la base no se convierte en una lista vacía',async()=>{
  fixture.error={message:'permission denied'}
  await expect(fetchServices('a')).rejects.toBeInstanceOf(ServiceLoadError)
 })
})
