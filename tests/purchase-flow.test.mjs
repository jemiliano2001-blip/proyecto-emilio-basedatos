import { test } from 'node:test'
import assert from 'node:assert/strict'
import { databaseFixture } from './db-fixture.mjs'

test('migraciones históricas: reserva y pago no se duplican', async (t) => {
  const db = await databaseFixture()
  t.after(() => db.close())
  await db.exec(`grant usage on schema public to authenticated; 
    grant usage on all sequences in schema public to authenticated;
    insert into auth.users values ('10000000-0000-4000-8000-000000000001');
    insert into usuarios(id,nombre,rol) values ('10000000-0000-4000-8000-000000000001','Prueba','acceso_total');
    insert into obras(id,nombre,presupuesto_mxn) values ('20000000-0000-4000-8000-000000000001','Proyecto de prueba',100);
    insert into catalogo_materiales(id,nombre_base,unidad_medida) values ('30000000-0000-4000-8000-000000000001','Material de prueba','PZA');
    insert into obra_material_contratado(obra_id,material_id,cantidad_contratada) values ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',10);
    select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
    set role authenticated;
    insert into solicitudes_material(id,obra_id,solicitante_id) values ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
    insert into solicitud_items(solicitud_id,material_id,cantidad_solicitada,monto_mxn) values ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',2,20);`)
  const id='40000000-0000-4000-8000-000000000001'
  await db.query('select aprobar_solicitud_compras($1)',[id])
  await assert.rejects(db.query('select aprobar_solicitud_compras($1)',[id]))
  await db.query('select aprobar_pago_solicitud($1)',[id])
  await assert.rejects(db.query('select aprobar_pago_solicitud($1)',[id]))
  assert.equal((await db.query('select count(*)::int as n from ordenes_compra')).rows[0].n,1)
})
