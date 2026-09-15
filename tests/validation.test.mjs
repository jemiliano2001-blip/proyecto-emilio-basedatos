import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateObraInput } from '../lib/validations/obra.ts'
import { listFilters, pageHref } from '../lib/list-filters.ts'
import { sanitizeNextPath } from '../lib/auth/safe-next.ts'
import { validateMaterialKitInput } from '../lib/validations/kit.ts'

test('edición normal no admite cierre y presupuesto inválido', () => {
  for (const raw of [{nombre:'Prueba',estado:'cerrada'}, {nombre:'Prueba',presupuesto_mxn:-1}, {nombre:'Prueba',presupuesto_mxn:Infinity}]) assert.equal(validateObraInput(raw).ok,false)
  assert.equal(validateObraInput({nombre:'Prueba',estado:'pausada',presupuesto_mxn:'10,50'}).ok,true)
})
test('filtros y enlaces no aceptan paginación o fechas inválidas', () => {
  const f=listFilters({pagina:'-1',desde:'2026-02-31',estatus:'inventado',q:'a%,(b)'},['recibida'])
  assert.equal(f.page,1);assert.equal(f.desde,'');assert.equal(f.estatus,'');assert.equal(f.q,'a   b')
  assert.equal(listFilters({pagina:'2'},[]).from,25)
  assert.equal(pageHref('/ordenes',{q:'OC 1'},2),'/ordenes?q=OC+1&pagina=2')
})
test('login rechaza redirección externa', () => {
  assert.equal(sanitizeNextPath('https://example.com'),'/')
  assert.equal(sanitizeNextPath('//example.com'),'/')
})

test('kit rechaza componentes repetidos y cantidades inválidas', () => {
  const material = '20000000-0000-4000-8000-000000000001'
  const repeated = validateMaterialKitInput({
    nombre: 'Kit de prueba',
    items: [
      { material_id: material, cantidad: 1 },
      { material_id: material, cantidad: 2 },
    ],
  })
  assert.equal(repeated.ok, false)

  const invalidQuantity = validateMaterialKitInput({
    nombre: 'Kit de prueba',
    items: [{ material_id: material, cantidad: 'no-numero' }],
  })
  assert.equal(invalidQuantity.ok, false)
})
