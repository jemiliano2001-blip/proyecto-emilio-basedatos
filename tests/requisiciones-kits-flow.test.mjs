import { test } from 'node:test'
import assert from 'node:assert/strict'
import { databaseFixture } from './db-fixture.mjs'

test('flujo de requisiciones: deducción provisional y consistencia de saldos en v_saldo_material_obra', async (t) => {
  const db = await databaseFixture()
  t.after(() => db.close())

  await db.exec(`
    grant usage on schema public to authenticated;
    grant usage on all sequences in schema public to authenticated;
    insert into auth.users values ('10000000-0000-4000-8000-000000000099');
    insert into usuarios(id, nombre, rol) values ('10000000-0000-4000-8000-000000000099', 'Admin Requisiciones', 'acceso_total');
    insert into obras(id, nombre, presupuesto_mxn, estado) values ('20000000-0000-4000-8000-000000000099', 'Obra Requisiciones Test', 50000, 'activa');
    insert into catalogo_materiales(id, nombre_base, unidad_medida, precio_base) values ('30000000-0000-4000-8000-000000000099', 'Cable Conductor 500', 'M', 120);
    insert into obra_material_contratado(obra_id, material_id, cantidad_contratada) values ('20000000-0000-4000-8000-000000000099', '30000000-0000-4000-8000-000000000099', 100);
    select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000099', false);
    set role authenticated;
  `)

  // 1. Saldo inicial sin solicitudes
  const rInicial = await db.query(
    'select cantidad_asignada, cantidad_en_proceso, cantidad_disponible from v_saldo_material_obra where obra_id = $1 and material_id = $2',
    ['20000000-0000-4000-8000-000000000099', '30000000-0000-4000-8000-000000000099']
  )
  assert.equal(rInicial.rows.length, 1)
  assert.equal(Number(rInicial.rows[0].cantidad_asignada), 100)
  assert.equal(Number(rInicial.rows[0].cantidad_en_proceso), 0)
  assert.equal(Number(rInicial.rows[0].cantidad_disponible), 100)

  // 2. Crear solicitud en estado 'recibida' (provisional sin aprobar por compras)
  await db.exec(`
    insert into solicitudes_material(id, obra_id, solicitante_id, estado)
    values ('40000000-0000-4000-8000-000000000099', '20000000-0000-4000-8000-000000000099', '10000000-0000-4000-8000-000000000099', 'recibida');

    insert into solicitud_items(solicitud_id, material_id, cantidad_solicitada, monto_mxn)
    values ('40000000-0000-4000-8000-000000000099', '30000000-0000-4000-8000-000000000099', 30, 3600);
  `)

  // La vista v_saldo_material_obra debe reflejar la reserva provisional inmediatamente (100 - 30 = 70 disponible)
  const rPendiente = await db.query(
    'select cantidad_asignada, cantidad_en_proceso, cantidad_disponible from v_saldo_material_obra where obra_id = $1 and material_id = $2',
    ['20000000-0000-4000-8000-000000000099', '30000000-0000-4000-8000-000000000099']
  )
  assert.equal(Number(rPendiente.rows[0].cantidad_disponible), 70)

  // 3. Aprobar solicitud por compras -> pasa a 'en_proceso' con reserva activa formal
  await db.query('select aprobar_solicitud_compras($1)', ['40000000-0000-4000-8000-000000000099'])

  // No debe haber duplicación de reserva: disponible sigue siendo 70, en_proceso es 30
  const rAprobada = await db.query(
    'select cantidad_asignada, cantidad_en_proceso, cantidad_disponible from v_saldo_material_obra where obra_id = $1 and material_id = $2',
    ['20000000-0000-4000-8000-000000000099', '30000000-0000-4000-8000-000000000099']
  )
  assert.equal(Number(rAprobada.rows[0].cantidad_en_proceso), 30)
  assert.equal(Number(rAprobada.rows[0].cantidad_disponible), 70)
})

test('gestión de materiales: borrado individual y de topes bajo política RLS', async (t) => {
  const db = await databaseFixture()
  t.after(() => db.close())

  await db.exec(`
    grant usage on schema public to authenticated;
    grant usage on all sequences in schema public to authenticated;
    insert into auth.users values ('10000000-0000-4000-8000-000000000098');
    insert into usuarios(id, nombre, rol) values ('10000000-0000-4000-8000-000000000098', 'Operación Topes', 'operacion');
    insert into obras(id, nombre, presupuesto_mxn, estado) values ('20000000-0000-4000-8000-000000000098', 'Obra Borrado Test', 10000, 'activa');
    insert into catalogo_materiales(id, nombre_base, unidad_medida) values ('30000000-0000-4000-8000-000000000098', 'Material a Borrar', 'PZA');
    insert into obra_material_contratado(obra_id, material_id, cantidad_contratada) values ('20000000-0000-4000-8000-000000000098', '30000000-0000-4000-8000-000000000098', 5);
    select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000098', false);
    set role authenticated;
  `)

  // Verificar que el material existe antes de borrar
  const antes = await db.query(
    'select count(*)::int as n from obra_material_contratado where obra_id = $1',
    ['20000000-0000-4000-8000-000000000098']
  )
  assert.equal(antes.rows[0].n, 1)

  // Borrar el material
  await db.query(
    'delete from obra_material_contratado where obra_id = $1 and material_id = $2',
    ['20000000-0000-4000-8000-000000000098', '30000000-0000-4000-8000-000000000098']
  )

  // Verificar que se eliminó correctamente
  const despues = await db.query(
    'select count(*)::int as n from obra_material_contratado where obra_id = $1',
    ['20000000-0000-4000-8000-000000000098']
  )
  assert.equal(despues.rows[0].n, 0)
})
