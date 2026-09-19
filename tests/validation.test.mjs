import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateObraInput } from '../lib/validations/obra.ts'
import { listFilters, pageHref } from '../lib/list-filters.ts'
import { sanitizeNextPath } from '../lib/auth/safe-next.ts'
import { validateMaterialKitInput } from '../lib/validations/kit.ts'
import { toFinite, formatMoneyMx } from '../lib/money.ts'

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

test('toFinite y formatMoneyMx previenen propagación de NaN', () => {
  assert.equal(toFinite(NaN, 0), 0)
  assert.equal(toFinite(Infinity, 10), 10)
  assert.equal(toFinite(-Infinity, 0), 0)
  assert.equal(toFinite(undefined, 5), 5)
  assert.equal(toFinite('abc', 0), 0)
  assert.equal(toFinite('123.45', 0), 123.45)
  assert.equal(toFinite(42, 0), 42)
  assert.equal(formatMoneyMx(NaN), '$0.00')
  assert.equal(formatMoneyMx(Infinity), '$0.00')
})

test('Auditoría Post-Fase: filtrado seguro con campos nulos o no definidos', () => {
  const items = [
    { nombre_base: null, variante: undefined, categoria: 'Obra Civil', subcategoria: null },
    { nombre_base: 'Tubo PVC', variante: null, categoria: null, subcategoria: 'Canalización' },
    { nombre_base: undefined, variante: 'Especial', categoria: undefined, subcategoria: undefined },
  ]
  const q = 'tubo'
  const filtrados = items.filter(
    (s) =>
      (s.nombre_base || '').toLowerCase().includes(q) ||
      (s.variante ? s.variante.toLowerCase().includes(q) : false) ||
      (s.categoria ? s.categoria.toLowerCase().includes(q) : false) ||
      (s.subcategoria ? s.subcategoria.toLowerCase().includes(q) : false)
  )
  assert.equal(filtrados.length, 1)
  assert.equal(filtrados[0].nombre_base, 'Tubo PVC')
})

