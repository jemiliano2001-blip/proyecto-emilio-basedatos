import { matchesOfflineOwner } from '../lib/offline/owner.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { putSolicitudPendiente, listSolicitudesPendientes, putRecepcionPendiente, listRecepcionesPendientes } from '../lib/offline/db.ts'
import { syncOfflineQueues } from '../lib/offline/sync.ts'

test('colas aisladas, idempotencia y recuperación ante red caída', async () => {
  const originalFetch = globalThis.fetch
  const record = { id: 'a', usuario_id: 'A', obra_id: 'p', nota: null, items: [], status: 'guardado_local', error: null, created_at: '', updated_at: '' }
  await putSolicitudPendiente(record)
  await putSolicitudPendiente({...record, id:'b', usuario_id:'B'})
  // Capturas antiguas sin propietario quedan preservadas, nunca se asignan al siguiente login.
  await putSolicitudPendiente({...record,id:'legacy',usuario_id:undefined})
  assert.deepEqual((await listSolicitudesPendientes('A')).map(r=>r.id), ['a'])
  assert.deepEqual((await listSolicitudesPendientes('B')).map(r=>r.id), ['b'])
  const sent=[]
  try {
    globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return Response.json({status:'sincronizado'}) }
    await Promise.all([syncOfflineQueues('A'),syncOfflineQueues('A')])
    assert.equal(sent.length,1)
    assert.equal(sent[0].usuario_id,'A')
    assert.equal((await listSolicitudesPendientes('B')).length,1)
    globalThis.fetch=async()=>{ throw new Error('offline') }
    assert.equal((await syncOfflineQueues('B')).reintentos,1)
    assert.equal((await listSolicitudesPendientes('B')).length,1)
    globalThis.fetch=async()=>Response.json({status:'conflicto',error:'Proyecto cerrado'})
    assert.equal((await syncOfflineQueues('B')).conflictos,1)
    globalThis.fetch=async()=>{throw new Error('No debe reintentar un conflicto automáticamente')}
    assert.equal((await syncOfflineQueues('B')).conflictos,1)
    const [conflict]=await listSolicitudesPendientes('B')
    await putSolicitudPendiente({...conflict,status:'guardado_local'})
    globalThis.fetch=async()=>Response.json({status:'sincronizado'})
    assert.equal((await syncOfflineQueues('B')).solicitudesOk,1)
    await putRecepcionPendiente({...record,id:'r',orden_id:'o',usuario_id:'A'})
    assert.equal((await listRecepcionesPendientes('B')).length,0)
  } finally { globalThis.fetch=originalFetch }
})

test('el servidor rechaza sesión cambiada y capturas sin propietario', () => {
  assert.equal(matchesOfflineOwner({usuario_id:'A'},'B'),false)
  assert.equal(matchesOfflineOwner({},'A'),false)
  assert.equal(matchesOfflineOwner({usuario_id:'A'},null),false)
  assert.equal(matchesOfflineOwner({usuario_id:'A'},'A'),true)
})
