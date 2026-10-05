import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accessFixture } from './access-fixture.mjs'

test('salud anónima consulta conexión sin exponer proyectos ni importes', async t => {
  const db = await accessFixture()
  t.after(() => db.close())
  assert.equal((await db.query("select has_column_privilege('anon','public.obras','id','select') permitido")).rows[0].permitido, true)
  await db.exec("insert into obras(nombre) values ('Proyecto prueba salud'); set role anon;")
  assert.equal((await db.query('select count(id)::int n from obras')).rows[0].n, 0)
  assert.equal((await db.query('select id from obras')).rows.length, 0)
  await assert.rejects(db.query('select presupuesto_mxn from obras'), /permission denied/i)
  await assert.rejects(db.query('select * from obras'), /permission denied/i)
})

test('preparación publica lecturas protegidas y RPC nuevas conservando contratos del frontend anterior', async t => {
  const db = await accessFixture({ preparacion: true })
  t.after(() => db.close())
  const result = (await db.query(`select
    to_regclass('public.catalogo_materiales_lectura') is not null as catalogo,
    to_regclass('public.obras_lectura') is not null as obras,
    to_regclass('public.solicitud_items_lectura') is not null as partidas,
    to_regprocedure('public.guardar_evidencias_recepcion(uuid,jsonb)') is not null as evidencia,
    has_column_privilege('authenticated','public.catalogo_materiales','precio_base','select') as precio_anterior,
    has_column_privilege('authenticated','public.obras','presupuesto_mxn','select') as presupuesto_anterior,
    has_table_privilege('authenticated','public.recepcion_fotos','insert') as evidencia_anterior,
    (select public from storage.buckets where id='obra-documentos') as documento_anterior`)).rows[0]
  for (const [name, value] of Object.entries(result)) assert.equal(value, true, name)
  const user = '10000000-0000-4000-8000-000000000071'
  await db.exec(`insert into auth.users values ('${user}');
    insert into usuarios(id,nombre,rol) values ('${user}','Campo prueba publicación','personal');
    insert into catalogo_materiales(nombre_base,unidad_medida,precio_base) values ('Material prueba publicación','pza',5);`)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user])
  await db.exec('set role authenticated')
  assert.equal((await db.query('select precio_base from catalogo_materiales_lectura limit 1')).rows[0].precio_base, null)
  // La llamada antigua de cuatro argumentos resuelve el quinto por DEFAULT;
  // llega al control de permiso, no a un error de firma/RPC inexistente.
  await assert.rejects(db.query('select reportar_instalacion_material(null,null,1,null)'), /permiso/i)
})

test('recepción mantiene propietario y rechaza sesiones de usuarios inactivos después de fotos', async t => {
  const db = await accessFixture()
  t.after(() => db.close())
  const owner = '10000000-0000-4000-8000-000000000001'
  const other = '10000000-0000-4000-8000-000000000002'
  const finance = '10000000-0000-4000-8000-000000000004'
  const reception = '40000000-0000-4000-8000-000000000001'
  await db.exec(`insert into auth.users values ('${owner}'),('${other}'),('${finance}');
    insert into usuarios(id,nombre,rol) values ('${owner}','Campo de prueba A','personal'),('${other}','Campo de prueba B','personal'),('${finance}','Finanzas prueba','finanzas');`)
  const project = (await db.query("insert into obras(nombre) values ('Proyecto de prueba') returning id")).rows[0].id
  const provider=(await db.query("insert into proveedores(nombre) values ('Proveedor prueba') returning id")).rows[0].id
  const order = (await db.query("insert into ordenes_compra(folio,obra_id,total,creado_por,proveedor_id) values ('PRUEBA-1',$1,0,$2,$3) returning id", [project,owner,provider])).rows[0].id
  await db.query('insert into recepciones_material(id,orden_id,receptor_id) values ($1,$2,$3)', [reception,order,owner])
  if ((await db.query("select to_regclass('public.usuario_obras') tab")).rows[0].tab) {
    await db.query('insert into usuario_obras(usuario_id,obra_id,asignado_por) values ($1,$3,$1),($2,$3,$1)', [owner,other,project])
  }
  const asUser = async id => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
    await db.exec('set role authenticated')
  }
  await asUser(other)
  assert.equal((await db.query('select count(*)::int n from recepciones_material')).rows[0].n,0)
  await assert.rejects(db.query('select detalle_recepcion($1)', [reception]), /permiso|autorizado/i)
  await asUser(owner)
  assert.equal((await db.query('select count(*)::int n from listar_ordenes_checklist()')).rows[0].n,1)
  assert.equal((await db.query('select detalle_recepcion($1) data', [reception])).rows[0].data.id,reception)
  const photo = {tipo_foto:'remision_documento',storage_path:'recepciones/prueba.jpg',foto_url:'https://example.test/prueba.jpg'}
  await db.query('select guardar_evidencias_recepcion($1,$2::jsonb)', [reception,JSON.stringify([photo])])
  await db.query('select guardar_evidencias_recepcion($1,$2::jsonb)', [reception,JSON.stringify([photo])])
  assert.equal((await db.query('select count(*)::int n from recepcion_fotos')).rows[0].n,1)
  await assert.rejects(db.query('select guardar_evidencias_recepcion($1,$2::jsonb)',[reception,JSON.stringify([{...photo,storage_path:'recepciones/invalida.jpg',foto_url:'https://example.test/invalida.jpg',calidad_score:3}])]))
  assert.equal((await db.query('select foto_remision_url from recepciones_material where id=$1',[reception])).rows[0].foto_remision_url,photo.foto_url)
  await asUser(finance)
  assert.equal((await db.query('select detalle_recepcion($1) data',[reception])).rows[0].data.id,reception)
  await assert.rejects(db.query('select guardar_evidencias_recepcion($1,$2::jsonb)',[reception,JSON.stringify([photo])]), /permiso/i)
  await db.exec('reset role')
  await db.query('update usuarios set activo=false where id=$1', [owner])
  await asUser(owner)
  await assert.rejects(db.query('select detalle_recepcion($1)', [reception]), /autenticado|autorizado/i)
  await assert.rejects(db.query('select crear_kit_con_items($1::jsonb,$2::jsonb)', ['{}','[]']), /autenticado/i)
})

test('servicios pasan por Compras con proveedor e importe, reservan y gastan presupuesto una sola vez', async t => {
  const db = await accessFixture()
  t.after(() => db.close())
  const admin='10000000-0000-4000-8000-000000000031'
  await db.exec(`insert into auth.users values ('${admin}'); insert into usuarios(id,nombre,rol) values ('${admin}','Admin prueba','acceso_total');`)
  const project=(await db.query("insert into obras(nombre,presupuesto_mxn) values ('Prueba servicios',1000) returning id")).rows[0].id
  const provider=(await db.query("insert into proveedores(nombre) values ('Proveedor prueba') returning id")).rows[0].id
  const request=(await db.query('insert into solicitudes_material(obra_id,solicitante_id) values ($1,$2) returning id',[project,admin])).rows[0].id
  const item=(await db.query("insert into solicitud_items(solicitud_id,tipo_linea,descripcion,monto_mxn) values ($1,'flete','Flete de prueba',100) returning id",[request])).rows[0].id
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin])
  await db.exec('set role authenticated')
  await assert.rejects(db.query('select aprobar_solicitud_compras($1,$2::jsonb)',[request,'[]']), /proveedor/i)
  await db.query('select aprobar_solicitud_compras($1,$2::jsonb)',[request,JSON.stringify([{item_id:item,precio_unitario:120,proveedor_id:provider}])])
  let balance=(await db.query('select * from saldo_presupuesto_proyecto($1)',[project])).rows[0]
  assert.equal(Number(balance.comprometido_mxn),120)
  await db.query('select aprobar_pago_solicitud($1)',[request])
  await assert.rejects(db.query('select aprobar_pago_solicitud($1)',[request]), /proceso/i)
  balance=(await db.query('select * from saldo_presupuesto_proyecto($1)',[project])).rows[0]
  assert.equal(Number(balance.gastado_mxn),120)
  assert.equal(Number(balance.comprometido_mxn),0)
  const order=(await db.query('select proveedor_id,total from ordenes_compra where solicitud_id=$1',[request])).rows[0]
  assert.equal(order.proveedor_id,provider)
  assert.equal(Number(order.total),120)
})

test('Personal no puede leer precio de catálogo ni presupuesto base por SELECT directo', async t => {
  const db = await accessFixture()
  t.after(() => db.close())
  const worker = '10000000-0000-4000-8000-000000000003'
  await db.exec(`insert into auth.users values ('${worker}');
    insert into usuarios(id,nombre,rol) values ('${worker}','Campo de prueba','personal');
    insert into catalogo_materiales(nombre_base,unidad_medida,precio_base) values ('Material de prueba','PZA',10);
    select set_config('request.jwt.claim.sub','${worker}',false); set role authenticated;`)
  await assert.rejects(db.query('select precio_base from catalogo_materiales'), /permission denied/)
  await assert.rejects(db.query('select presupuesto_mxn from obras'), /permission denied/)
  await assert.rejects(db.query('select monto_mxn from solicitud_items'), /permission denied/)
})

test('Personal ve varias asignaciones, importes nulos y documentos operativos; solo admin reemplaza proyectos', async t => {
  const db = await accessFixture()
  t.after(() => db.close())
  const personal = '10000000-0000-4000-8000-000000000011'
  const admin = '10000000-0000-4000-8000-000000000012'
  await db.exec(`insert into auth.users values ('${personal}'),('${admin}');
    insert into usuarios(id,nombre,rol) values ('${personal}','Personal prueba','personal'),('${admin}','Admin prueba','acceso_total');`)
  const projects = (await db.query("insert into obras(nombre,presupuesto_mxn) values ('A',100),('B',200),('Ajeno',300) returning id")).rows.map(r => r.id)
  await db.query("insert into catalogo_materiales(nombre_base,unidad_medida,precio_base) values ('Prueba','PZA',50)")
  const request=(await db.query('insert into solicitudes_material(obra_id,solicitante_id) values ($1,$2) returning id',[projects[0],personal])).rows[0].id
  await db.query("insert into solicitud_items(solicitud_id,tipo_linea,descripcion,monto_mxn) values ($1,'flete','Prueba',80)",[request])
  await db.query("insert into obra_presupuesto_movimientos(obra_id,tipo,monto_mxn,creado_por) values ($1,'gasto',10,$2)",[projects[0],admin])
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin])
  await db.exec('set role authenticated')
  await db.query('select asignar_proyectos_usuario($1,$2::uuid[])',[personal,projects.slice(0,2)])
  await db.exec('reset role')
  for (const [index, type] of ['plano','presupuesto','general'].entries()) {
    const project = index === 2 ? projects[2] : projects[0]
    const path = `obras/${project}/${type}.pdf`
    await db.query("insert into obra_documentos(obra_id,nombre,tipo_documento,archivo_path,archivo_url) values ($1,$2,$2,$3,$3)", [project,type,path])
    await db.query("insert into storage.objects(bucket_id,name) values ('obra-documentos',$1)", [path])
  }
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [personal])
  await db.exec('set role authenticated')
  const visible = (await db.query('select id,presupuesto_mxn from obras_lectura')).rows
  assert.deepEqual(visible.map(r => r.id).sort(), projects.slice(0,2).sort())
  assert.ok(visible.every(r => r.presupuesto_mxn === null))
  assert.equal((await db.query('select precio_base from catalogo_materiales_lectura')).rows[0].precio_base, null)
  assert.equal((await db.query('select monto_mxn from solicitud_items_lectura')).rows[0].monto_mxn,null)
  assert.equal((await db.query('select count(*)::int n from obra_presupuesto_movimientos')).rows[0].n,0)
  assert.equal((await db.query('select count(*)::int n from obra_documentos')).rows[0].n, 1)
  assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n, 1)
  await assert.rejects(db.query('select asignar_proyectos_usuario($1,$2::uuid[])',[personal,[]]), /Acceso Total/)
  await assert.rejects(db.query('select reportar_instalacion_material($1,$2,1,null)',[projects[2],personal]), /permiso/i)
  await assert.rejects(db.query('select crear_solicitud_traspaso($1,$2,null,$3::jsonb)',[projects[0],projects[2],'[]']), /permiso/i)
  await assert.rejects(db.query('select crear_solicitud_con_items($1,null,$2::jsonb,null)',[projects[2],'[]']), /permiso/i)
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin])
  await db.exec('set role authenticated')
  assert.equal(Number((await db.query('select precio_base from catalogo_materiales_lectura')).rows[0].precio_base), 50)
  await assert.rejects(db.query('select asignar_proyectos_usuario($1,$2::uuid[])',[personal,[projects[0],admin]]), /lista/i)
  assert.equal((await db.query('select count(*)::int n from usuario_obras where usuario_id=$1',[personal])).rows[0].n,2)
  await db.query('select asignar_proyectos_usuario($1,$2::uuid[])',[personal,[]])
  assert.equal((await db.query('select count(*)::int n from usuario_obras where usuario_id=$1',[personal])).rows[0].n,0)
})

test('instalación reintentada conserva ID y cantidad, y rechaza cambiar su contenido', async t => {
  const db = await accessFixture()
  t.after(() => db.close())
  const worker = '10000000-0000-4000-8000-000000000021'
  const id = '60000000-0000-4000-8000-000000000021'
  await db.exec(`insert into auth.users values ('${worker}'); insert into usuarios(id,nombre,rol) values ('${worker}','Prueba','personal');`)
  const project = (await db.query("insert into obras(nombre) values ('Prueba') returning id")).rows[0].id
  const material = (await db.query("insert into catalogo_materiales(nombre_base,unidad_medida) values ('Material','PZA') returning id")).rows[0].id
  await db.query('insert into usuario_obras(usuario_id,obra_id,asignado_por) values ($1,$2,$1)', [worker,project])
  const order = (await db.query("insert into ordenes_compra(folio,obra_id,total,creado_por) values ('TEST-INST',$1,0,$2) returning id",[project,worker])).rows[0].id
  const item = (await db.query('insert into orden_compra_items(orden_id,material_id,cantidad,precio_unitario,subtotal) values ($1,$2,10,0,0) returning id',[order,material])).rows[0].id
  const reception = '40000000-0000-4000-8000-000000000021'
  await db.query("insert into recepciones_material(id,orden_id,receptor_id,estado,revisado_por,revisado_en) values ($1,$2,$3,'aprobada',$3,now())",[reception,order,worker])
  await db.query("insert into recepcion_items(recepcion_id,orden_item_id,cantidad_recibida,cantidad_danada,estado) values ($1,$2,10,0,'completo')",[reception,item])
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [worker])
  await db.exec('set role authenticated')
  const call = amount => db.query('select reportar_instalacion_material($1,$2,$3,$4,$5) id',[project,material,amount,'Prueba',id])
  assert.equal((await call(3)).rows[0].id,id)
  assert.equal((await call(3)).rows[0].id,id)
  assert.equal((await db.query('select sum(cantidad) n from obra_material_instalaciones')).rows[0].n,'3.00')
  await assert.rejects(call(4), /contenido|conflicto/i)
  await assert.rejects(db.query('select reportar_instalacion_material($1,$2,8,null)',[project,material]), /pendiente/i)
})

test('Personal solicita entre proyectos asignados y confirma únicamente un destino asignado', async t => {
  const db=await accessFixture()
  t.after(()=>db.close())
  const worker='10000000-0000-4000-8000-000000000041'
  const admin='10000000-0000-4000-8000-000000000042'
  await db.exec(`insert into auth.users values ('${worker}'),('${admin}');
    insert into usuarios(id,nombre,rol) values ('${worker}','Campo prueba','personal'),('${admin}','Admin prueba','acceso_total');`)
  const projects=(await db.query("insert into obras(nombre,presupuesto_mxn) values ('Origen prueba',1000),('Destino prueba',1000) returning id")).rows.map(r=>r.id)
  const material=(await db.query("insert into catalogo_materiales(nombre_base,unidad_medida) values ('Material prueba','PZA') returning id")).rows[0].id
  await db.query('insert into obra_material_contratado(obra_id,material_id,cantidad_contratada) values ($1,$2,10)',[projects[0],material])
  const asUser=async id=>{
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])
    await db.exec('set role authenticated')
  }
  await asUser(admin)
  await db.query('select asignar_proyectos_usuario($1,$2::uuid[])',[worker,projects])
  await asUser(worker)
  const transfer=(await db.query('select crear_solicitud_traspaso($1,$2,null,$3::jsonb) id',[projects[0],projects[1],JSON.stringify([{material_id:material,cantidad:2}])])).rows[0].id
  await assert.rejects(db.query('select aprobar_traspaso($1)',[transfer]), /autorizado/i)
  await asUser(admin)
  await db.query('select aprobar_traspaso($1)',[transfer])
  await db.query('select asignar_proyectos_usuario($1,$2::uuid[])',[worker,[projects[0]]])
  await asUser(worker)
  await assert.rejects(db.query('select confirmar_recepcion_traspaso($1)',[transfer]), /destino/i)
  await asUser(admin)
  await db.query('select asignar_proyectos_usuario($1,$2::uuid[])',[worker,[projects[1]]])
  await asUser(worker)
  await db.query('select confirmar_recepcion_traspaso($1)',[transfer])
  assert.equal((await db.query('select estado from traspasos_obra where id=$1',[transfer])).rows[0].estado,'completado')
  assert.equal(Number((await db.query('select cantidad_pendiente_instalar from v_inventario_campo_obra where obra_id=$1',[projects[1]])).rows[0].cantidad_pendiente_instalar),2)
})
