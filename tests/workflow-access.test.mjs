import { test } from 'node:test'
import assert from 'node:assert/strict'
import { etapaAprobacionLote } from '../lib/solicitudes-workflow.ts'
import { homePathForRol, tabsAbastecimiento } from '../lib/roles.ts'
import { pageHref } from '../lib/list-filters.ts'
import { navItemsVisibles } from '../lib/nav.ts'

test('Acceso Total elige etapa por estatus y nunca confunde compras con pago', () => {
  assert.equal(etapaAprobacionLote(['recibida'], true, true), 'compras')
  assert.equal(etapaAprobacionLote(['en_proceso'], true, true), 'finanzas')
  assert.equal(etapaAprobacionLote(['en_proceso', 'recibida'], true, true), null)
  assert.equal(etapaAprobacionLote(['en_proceso'], true, false), null)
  assert.equal(etapaAprobacionLote(['finalizada'], true, true), null)
  assert.equal(etapaAprobacionLote([], true, true), null)
})
test('colas y navegación corresponden al rol y mantienen historial al paginar', () => {
  assert.equal(homePathForRol('finanzas'), '/solicitudes')
  assert.deepEqual(tabsAbastecimiento('personal'), [])
  assert.deepEqual(tabsAbastecimiento('finanzas'), ['finanzas', 'transito'])
  assert.equal(navItemsVisibles({rol:'personal', traspasosDisponibles:true}).some(i => i.id === 'traspasos'), true)
  assert.match(pageHref('/solicitudes', {vista:'historial', q:'tubo'}, 2), /vista=historial/)
})
