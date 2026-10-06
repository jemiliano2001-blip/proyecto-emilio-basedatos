import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generarMatrizQR } from '../lib/qr.ts'

// Decodificador mínimo, solo para esta prueba: lee la matriz como lo haría un lector real
// (formato BCH → máscara → recorrido en zigzag → des-entrelazado de bloques → modo byte).
// Cubre el único caso que imprime la app: payload `emilio:oc:<uuid>` (46 bytes) con nivel M → versión 4.
const MASCARAS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

function bch15(dato) {
  let v = dato << 10
  for (let i = 14; i >= 10; i--) if ((v >> i) & 1) v ^= 0x537 << (i - 10)
  return ((dato << 10) | v) ^ 0x5412
}
const FORMATOS_VALIDOS = new Map(Array.from({ length: 32 }, (_, d) => [bch15(d), d]))

function leerFormato(m) {
  const n = m.length
  const bit = (r, c) => (m[r][c] ? 1 : 0)
  // Bit i (0 = menos significativo) de cada copia, según ISO 18004 (figura de información de formato).
  let vertical = 0
  let horizontal = 0
  for (let i = 0; i < 15; i++) {
    const [rv, cv] = i < 6 ? [i, 8] : i < 8 ? [i + 1, 8] : [n - 15 + i, 8]
    const [rh, ch] = i < 8 ? [8, n - i - 1] : i === 8 ? [8, 7] : [8, 14 - i]
    vertical |= bit(rv, cv) << i
    horizontal |= bit(rh, ch) << i
  }
  return [vertical, horizontal]
}

function decodificar(m) {
  const n = m.length
  const [f1, f2] = leerFormato(m)
  assert.equal(f1, f2, 'las dos copias de la información de formato deben coincidir')
  assert.ok(FORMATOS_VALIDOS.has(f1), 'la información de formato debe ser un código BCH válido')
  const dato = FORMATOS_VALIDOS.get(f1)
  const nivel = dato >> 3
  const mascara = dato & 7

  // Módulos de función (V4): finders+separadores+formato, timing, alineación en (26,26) y módulo oscuro.
  const funcion = Array.from({ length: n }, () => Array(n).fill(false))
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) funcion[r][c] = true
  for (let r = 0; r < 8; r++) for (let c = n - 8; c < n; c++) funcion[r][c] = true
  for (let r = n - 8; r < n; r++) for (let c = 0; c < 9; c++) funcion[r][c] = true
  for (let i = 0; i < n; i++) { funcion[6][i] = true; funcion[i][6] = true }
  for (let r = 24; r <= 28; r++) for (let c = 24; c <= 28; c++) funcion[r][c] = true
  for (let c = n - 8; c < n; c++) funcion[8][c] = true
  for (let r = n - 7; r < n; r++) funcion[r][8] = true

  const bits = []
  let arriba = true
  for (let derecha = n - 1; derecha > 0; derecha -= 2) {
    if (derecha === 6) derecha--
    for (let k = 0; k < n; k++) {
      const r = arriba ? n - 1 - k : k
      for (const c of [derecha, derecha - 1]) {
        if (funcion[r][c]) continue
        bits.push(m[r][c] !== MASCARAS[mascara](r, c) ? 1 : 0)
      }
    }
    arriba = !arriba
  }
  const palabras = []
  for (let i = 0; i + 7 < bits.length; i += 8) palabras.push(parseInt(bits.slice(i, i + 8).join(''), 2))

  // V4-M: 2 bloques de 32 palabras de datos (+16 de corrección cada uno), entrelazados.
  const datos = Array.from({ length: 64 }, (_, j) => palabras[2 * (j % 32) + Math.floor(j / 32)])
  const flujo = datos.map((b) => b.toString(2).padStart(8, '0')).join('')
  assert.equal(flujo.slice(0, 4), '0100', 'modo byte')
  const largo = parseInt(flujo.slice(4, 12), 2)
  const bytes = Array.from({ length: largo }, (_, i) => parseInt(flujo.slice(12 + i * 8, 20 + i * 8), 2))
  return { nivel, texto: String.fromCharCode(...bytes), version: (n - 17) / 4 }
}

const UUID = '5f0c6d1e-3b7a-4c52-9e48-1a2b3c4d5e6f'
const PAYLOAD = `emilio:oc:${UUID}`

test('QR de la OC: versión 4, nivel de corrección M y formato BCH válido', () => {
  const m = generarMatrizQR(PAYLOAD)
  assert.equal(m.length, 33)
  assert.equal(decodificar(m).version, 4)
  assert.equal(decodificar(m).nivel, 0, 'nivel M = 00')
})

test('QR de la OC: un lector recupera exactamente el texto codificado', () => {
  assert.equal(decodificar(generarMatrizQR(PAYLOAD)).texto, PAYLOAD)
  const otro = `emilio:oc:${'0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'}`
  assert.equal(decodificar(generarMatrizQR(otro)).texto, otro)
})

test('QR de la OC: patrones de esquina, temporización y módulo oscuro', () => {
  const m = generarMatrizQR(PAYLOAD)
  const n = m.length
  for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const borde = r === 0 || r === 6 || c === 0 || c === 6
      const centro = r >= 2 && r <= 4 && c >= 2 && c <= 4
      assert.equal(m[r0 + r][c0 + c], borde || centro, `finder en (${r0},${c0}) celda (${r},${c})`)
    }
  }
  for (let i = 8; i < n - 8; i++) {
    assert.equal(m[6][i], i % 2 === 0)
    assert.equal(m[i][6], i % 2 === 0)
  }
  assert.equal(m[n - 8][8], true)
})

test('QR de la OC: es determinista y distingue órdenes distintas', () => {
  assert.deepEqual(generarMatrizQR(PAYLOAD), generarMatrizQR(PAYLOAD))
  assert.notDeepEqual(generarMatrizQR(PAYLOAD), generarMatrizQR(`emilio:oc:${UUID.replace('5f0c', '6f0c')}`))
})
