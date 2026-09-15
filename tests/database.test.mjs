import { test } from 'node:test'
import assert from 'node:assert/strict'
import { databaseFixture } from './db-fixture.mjs'

test('integridad de proyectos y precios con PostgreSQL aislado y roles reales', async (t) => {
  const db = await databaseFixture()
  t.after(() => db.close())
  const admin = '10000000-0000-4000-8000-000000000001'
  const operator = '10000000-0000-4000-8000-000000000002'
  const worker = '10000000-0000-4000-8000-000000000003'
  const material = '20000000-0000-4000-8000-000000000001'
  await db.exec(`insert into auth.users values ('${admin}'),('${operator}'),('${worker}');
    insert into usuarios(id,nombre,rol) values ('${admin}','Prueba admin','acceso_total'),('${operator}','Prueba operación','operacion'),('${worker}','Prueba campo','personal');
    insert into catalogo_materiales(id,nombre_base,unidad_medida,precio_base) values ('${material}','Material de prueba','PZA',10);`)
  const asUser = async id => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
    await db.exec('set role authenticated')
  }
  const data = { nombre: 'Proyecto de prueba', estado: 'activa', presupuesto_mxn: 0 }
  const topes = [{ material_id: material, cantidad_contratada: 2 }]
  await asUser(admin)
  const created = await db.query('select crear_proyecto_con_presupuesto($1,$2) as id', [data, topes])
  const id = created.rows[0].id
  assert.equal((await db.query('select presupuesto_mxn from obras where id=$1', [id])).rows[0].presupuesto_mxn, '20.00')
  await t.test('un fallo en topes revierte también la cabecera', async () => {
    const before = (await db.query('select count(*)::int as n from obras')).rows[0].n
    await assert.rejects(db.query('select crear_proyecto_con_presupuesto($1,$2)', [data, [...topes, ...topes]]), /duplicate/)
    assert.equal((await db.query('select count(*)::int as n from obras')).rows[0].n, before)
  })
  await t.test('asignación masiva valida todo antes de alterar topes o presupuesto', async () => {
    const presupuestoAntes = (await db.query('select presupuesto_mxn from obras where id=$1', [id])).rows[0]
      .presupuesto_mxn
    await assert.rejects(
      db.query('select asignar_materiales_proyecto($1,$2)', [
        id,
        [
          { material_id: material, cantidad: 3 },
          { material_id: '30000000-0000-4000-8000-000000000099', cantidad: 2 },
        ],
      ]),
      /material no está disponible/
    )
    assert.equal(
      (await db.query('select cantidad_contratada from obra_material_contratado where obra_id=$1 and material_id=$2', [id, material]))
        .rows[0].cantidad_contratada,
      '2.00'
    )
    assert.equal((await db.query('select presupuesto_mxn from obras where id=$1', [id])).rows[0].presupuesto_mxn, presupuestoAntes)
  })
  await t.test('PATCH directo no puede cerrar, reabrir ni falsificar fecha', async () => {
    await asUser(operator)
    for (const change of ["estado='cerrada'", "estado='activa'", 'cerrado_en=now()', "cierre_nota='falsa'"]) {
      await assert.rejects(db.exec(`update obras set ${change} where id='${id}'`), /permission denied/)
    }
    await assert.rejects(db.query('select editar_proyecto($1,$2)', [id, {...data, estado:'cerrada'}]), /cierre formal/)
  })
  await t.test('cierre real bloquea pendientes y reapertura respeta roles', async () => {
    await db.exec('reset role')
    await db.exec(`insert into solicitudes_material(obra_id,solicitante_id,estado) values ('${id}','${operator}','recibida')`)
    await asUser(operator)
    await assert.rejects(db.query('select cerrar_obra($1)', [id]), /pendientes/)
    await db.exec('reset role; delete from solicitudes_material')
    await asUser(operator)
    await db.query('select cerrar_obra($1)', [id])
    await assert.rejects(db.query('select reabrir_obra($1)', [id]), /Solo Acceso Total/)
    await assert.rejects(db.query('select editar_proyecto($1,$2)', [id,data]), /Reabre/)
    await asUser(admin)
    await db.query('select reabrir_obra($1)', [id])
  })
  await t.test('Personal no obtiene precios por SELECT, wildcard ni RPC', async () => {
    await asUser(worker)
    await assert.rejects(db.query('select precio_unitario_mxn from traspaso_items'), /permission denied/)
    await assert.rejects(db.query('select * from traspaso_items'), /permission denied/)
    await assert.rejects(db.query('select precios_traspaso($1)', [id]), /permiso/)
    await db.query('select id, cantidad from traspaso_items')
    await assert.rejects(db.query('select crear_proyecto_con_presupuesto($1,$2)', [data,topes]), /permiso/)
    await assert.rejects(db.query('select saldo_presupuesto_proyecto($1)', [id]), /permiso/)
    await assert.rejects(db.query('select conciliacion_presupuesto_proyecto($1)', [id]), /permiso/)
  })
  await t.test('reportes financieros siguen funcionando y usuarios inactivos quedan bloqueados', async () => {
    await asUser(admin)
    assert.equal((await db.query('select * from saldo_presupuesto_proyecto($1)', [id])).rows.length,1)
    assert.equal((await db.query('select * from conciliacion_presupuesto_proyecto($1)', [id])).rows.length,1)
    await db.exec('reset role')
    await db.query('update usuarios set activo=false where id=$1',[admin])
    await asUser(admin)
    await assert.rejects(db.query('select precios_traspaso($1)', [id]), /permiso/)
    await assert.rejects(db.query('select editar_proyecto($1,$2)', [id,data]), /permiso/)
  })
})
