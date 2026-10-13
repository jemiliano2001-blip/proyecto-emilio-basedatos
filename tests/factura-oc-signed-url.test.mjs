import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { esIdFacturaOrden, FACTURA_SIGNED_URL_SECONDS, hrefFacturaOrden } from '../lib/facturas-oc.ts'

const FACTURA_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

test('el enlace de factura apunta a la ruta que firma, no a Storage', () => {
  assert.equal(hrefFacturaOrden(FACTURA_ID), `/api/ordenes/facturas/${FACTURA_ID}`)
  assert.equal(hrefFacturaOrden(FACTURA_ID).includes('getPublicUrl'), false)
  assert.equal(hrefFacturaOrden(FACTURA_ID).startsWith('http'), false)
  assert.equal(FACTURA_SIGNED_URL_SECONDS, 60)
  assert.equal(esIdFacturaOrden(FACTURA_ID), true)
  assert.equal(esIdFacturaOrden('no-es-uuid'), false)
  assert.equal(esIdFacturaOrden(`${FACTURA_ID}/../otro`), false)
})

test('subir una factura ya no guarda la URL pública del bucket', () => {
  const fuente = readFileSync('lib/actions/ordenes.ts', 'utf8')
  assert.equal(fuente.includes('getPublicUrl'), false)
  assert.match(fuente, /archivo_url:\s*hrefFacturaOrden\(facturaId\)/)
  assert.match(fuente, /archivo_path:\s*storagePath/)
})

test('la pantalla de la OC y la sección de facturas usan la ruta firmada', () => {
  const pagina = readFileSync('app/ordenes/[id]/page.tsx', 'utf8')
  const seccion = readFileSync('components/OrdenCompraFacturasSection.tsx', 'utf8')
  assert.match(pagina, /archivo_url:\s*hrefFacturaOrden\(f\.id\)/)
  assert.equal(seccion.includes('href={f.archivo_url}'), false)
  assert.equal(seccion.includes('url: f.archivo_url'), false)
  assert.match(seccion, /href=\{hrefFacturaOrden\(f\.id\)\}/)
  assert.match(seccion, /url:\s*hrefFacturaOrden\(f\.id\)/)
})

test('la ruta de factura firma con el cliente del usuario y redirige, como los documentos de obra', () => {
  const ruta = readFileSync('app/api/ordenes/facturas/[id]/route.ts', 'utf8')
  const documentos = readFileSync('app/api/documentos/[id]/route.ts', 'utf8')
  assert.match(ruta, /getSessionUsuario\(\)/)
  assert.match(ruta, /puedeVerPrecios\(session\.rol\)/)
  assert.match(ruta, /from\('orden_compra_facturas'\)/)
  assert.match(ruta, /select\('archivo_path'\)/)
  assert.match(ruta, /from\('obra-documentos'\)/)
  assert.match(ruta, /createSignedUrl\(factura\.archivo_path,\s*FACTURA_SIGNED_URL_SECONDS\)/)
  assert.match(ruta, /NextResponse\.redirect\(data\.signedUrl\)/)
  assert.match(ruta, /Cache-Control',\s*'private, no-store'/)
  assert.match(ruta, /Referrer-Policy',\s*'no-referrer'/)
  assert.equal(ruta.includes('service_role'), false)
  assert.equal(ruta.includes('getPublicUrl'), false)
  assert.match(documentos, /createSignedUrl\(documento\.archivo_path,\s*60\)/)
  assert.match(documentos, /NextResponse\.redirect\(data\.signedUrl\)/)
})
