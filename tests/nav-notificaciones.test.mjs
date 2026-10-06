import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hrefNotificacion } from '../lib/nav.ts'

const ID = '20000000-0000-4000-8000-0000000000f1'

test('hrefNotificacion enlaza las alertas de saldo al proyecto', () => {
  assert.equal(hrefNotificacion('alerta_saldo_material', ID), `/obras/${ID}`)
  assert.equal(hrefNotificacion('alerta_saldo_presupuesto', ID), `/obras/${ID}`)
  assert.equal(hrefNotificacion('alerta_saldo_material', null), null)
  assert.equal(hrefNotificacion('solicitud_en_proceso', ID), `/solicitudes/${ID}`)
  assert.equal(hrefNotificacion('obra_cerrada', ID), `/obras/${ID}`)
})
