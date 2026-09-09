import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRateLimit, resetRateLimit, getClientIp } from '../lib/rate-limit.ts'
import { sanitizeLogData } from '../lib/logger.ts'
import { databaseFixture } from './db-fixture.mjs'

test('rate limiting por ventana deslizante bloquea y desbloquea según umbral', () => {
  const key = 'test-ip-rate-limit'
  resetRateLimit(key)

  // 3 permitidos en ventana de 1000ms
  const opt = { maxRequests: 3, windowMs: 1000 }
  assert.equal(checkRateLimit(key, opt).allowed, true)
  assert.equal(checkRateLimit(key, opt).allowed, true)
  assert.equal(checkRateLimit(key, opt).allowed, true)

  // 4to intento debe ser bloqueado
  const blocked = checkRateLimit(key, opt)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.remaining, 0)
  assert.ok(blocked.resetMs > 0)

  // Reseteo manual debe permitir de nuevo
  resetRateLimit(key)
  assert.equal(checkRateLimit(key, opt).allowed, true)
})

test('getClientIp extrae IP real o encabezados proxy', () => {
  const h1 = new Headers({ 'x-forwarded-for': '203.0.113.195, 70.41.3.18' })
  assert.equal(getClientIp(h1), '203.0.113.195')

  const h2 = new Headers({ 'x-real-ip': '198.51.100.1' })
  assert.equal(getClientIp(h2), '198.51.100.1')

  const h3 = new Headers()
  assert.equal(getClientIp(h3), '127.0.0.1')
})

test('sanitizeLogData redacta contraseñas, tokens y datos sensibles recursivamente', () => {
  const input = {
    email: 'test@example.com',
    password: 'SuperSecretPassword123!',
    token: 'jwt.token.here',
    nested: {
      auth_token: 'secret',
      safeData: 42,
    },
    items: [
      { id: '1', service_role: 'secret' },
      { id: '2', title: 'Normal Item' },
    ],
  }

  const sanitized = sanitizeLogData(input)
  assert.equal(sanitized.email, 'test@example.com')
  assert.equal(sanitized.password, '[REDACTED]')
  assert.equal(sanitized.token, '[REDACTED]')
  assert.equal(sanitized.nested.auth_token, '[REDACTED]')
  assert.equal(sanitized.nested.safeData, 42)
  assert.equal(sanitized.items[0].service_role, '[REDACTED]')
  assert.equal(sanitized.items[1].title, 'Normal Item')
})

test('creación atómica de requisición en PostgreSQL aislado (Migración 0017)', async (t) => {
  const db = await databaseFixture()
  t.after(() => db.close())

  const admin = '30000000-0000-4000-8000-000000000001'
  const worker = '30000000-0000-4000-8000-000000000002'
  const mat1 = '40000000-0000-4000-8000-000000000001'

  await db.exec(`
    insert into auth.users values ('${admin}'), ('${worker}');
    insert into usuarios(id, nombre, rol) values
      ('${admin}', 'Admin Emilio', 'acceso_total'),
      ('${worker}', 'Personal Obra', 'personal');
    insert into catalogo_materiales(id, nombre_base, unidad_medida, precio_base, activo)
      values ('${mat1}', 'Cable THW 12', 'MTO', 15.50, true);
  `)

  const asUser = async (id) => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
    await db.exec('set role authenticated')
  }

  // 1. Crear proyecto con tope de material contratado (50 MTO)
  await asUser(admin)
  const obraRes = await db.query(
    'select crear_proyecto_con_presupuesto($1, $2) as id',
    [
      { nombre: 'Proyecto Requisición Atómica', estado: 'activa', presupuesto_mxn: 1000 },
      [{ material_id: mat1, cantidad_contratada: 50 }],
    ]
  )
  const obraId = obraRes.rows[0].id

  // 2. Personal levanta requisición válida de 20 MTO
  await asUser(worker)
  const items = [{ tipo_linea: 'material', material_id: mat1, cantidad_solicitada: 20 }]
  const reqRes = await db.query(
    'select crear_solicitud_con_items($1, $2, $3) as id',
    [obraId, 'Nota de campo inicial', JSON.stringify(items)]
  )
  const solicitudId = reqRes.rows[0].id
  assert.ok(solicitudId)

  // Verificar que la requisición y el renglón existan
  const reqDb = await db.query('select * from solicitudes_material where id = $1', [solicitudId])
  assert.equal(reqDb.rows.length, 1)
  assert.equal(reqDb.rows[0].estado, 'recibida')

  const itemsDb = await db.query('select * from solicitud_items where solicitud_id = $1', [solicitudId])
  assert.equal(itemsDb.rows.length, 1)
  assert.equal(Number(itemsDb.rows[0].cantidad_solicitada), 20)

  // 3. Verificar que se haya emitido la notificación a compras (verificada por admin o superuser)
  await db.exec('reset role')
  const notifDb = await db.query('select * from notificaciones where referencia_id = $1', [solicitudId])
  assert.equal(notifDb.rows.length, 1)
  assert.equal(notifDb.rows[0].rol_destino, 'compras')

  // 4. Intentar exceder saldo disponible (contratado 50, pide 55): debe hacer ROLLBACK atómico
  await asUser(worker)
  const countBefore = (await db.query('select count(*)::int as c from solicitudes_material')).rows[0].c
  const itemsExcedidos = [{ tipo_linea: 'material', material_id: mat1, cantidad_solicitada: 55 }]
  await assert.rejects(
    db.query('select crear_solicitud_con_items($1, $2, $3)', [obraId, 'Exceso', JSON.stringify(itemsExcedidos)]),
    /Saldo insuficiente/
  )
  const countAfter = (await db.query('select count(*)::int as c from solicitudes_material')).rows[0].c
  assert.equal(countAfter, countBefore)
})
