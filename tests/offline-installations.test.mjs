import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { putInstalacionPendiente, listInstalacionesPendientes, putSolicitudPendiente, listSolicitudesPendientes } from '../lib/offline/db.ts'
import { syncOfflineQueues } from '../lib/offline/sync.ts'
import { validateInstalacionInput } from '../lib/validations/instalacion.ts'

test('instalaciones offline aíslan usuarios y conservan ID después de un fallo de red', async () => {
  const original = globalThis.fetch
  const record = { id:'i-A',usuario_id:'A',obra_id:'p',material_id:'m',cantidad:2,nota:null,status:'guardado_local',error:null,created_at:'',updated_at:'' }
  await putInstalacionPendiente(record)
  await putInstalacionPendiente({...record,id:'i-B',usuario_id:'B'})
  await putSolicitudPendiente({id:'legacy-test',usuario_id:'C',items:[],obra_id:'p',status:'guardado_local'})
  assert.equal((await listSolicitudesPendientes('C')).length,1)
  assert.deepEqual((await listInstalacionesPendientes('A')).map(r=>r.id),['i-A'])
  const sent=[]
  try {
    globalThis.fetch=async()=>{throw new Error('red')}
    assert.equal((await syncOfflineQueues('A')).reintentos,1)
    globalThis.fetch=async(url,options)=>{sent.push([url,JSON.parse(options.body)]);return Response.json({status:'sincronizado'})}
    const summary = await syncOfflineQueues('A')
    assert.equal(summary.instalacionesOk,1)
    assert.equal(sent[0][0],'/api/instalaciones/sync')
    assert.equal(sent[0][1].id,'i-A')
    assert.equal((await listInstalacionesPendientes('A')).length,0)
    assert.equal((await listInstalacionesPendientes('B')).length,1)
    globalThis.fetch=async()=>Response.json({status:'no_autenticado'})
    assert.equal((await syncOfflineQueues('B')).noAutenticado,true)
    assert.equal((await listInstalacionesPendientes('B'))[0].status,'necesita_revision')
  } finally {globalThis.fetch=original}
})
test('instalación valida identificadores, precisión de cantidad y notas', () => {
  const input={id:'10000000-0000-4000-8000-000000000001',obra_id:'20000000-0000-4000-8000-000000000001',material_id:'30000000-0000-4000-8000-000000000001',cantidad:'2,50',nota:'  prueba '}
  assert.equal(validateInstalacionInput(input).data.cantidad,2.5)
  assert.equal(validateInstalacionInput({...input,cantidad:0.001}).ok,false)
  assert.equal(validateInstalacionInput({...input,obra_id:'bad'}).ok,false)
  assert.equal(validateInstalacionInput({...input,nota:'x'.repeat(2001)}).ok,false)
})
