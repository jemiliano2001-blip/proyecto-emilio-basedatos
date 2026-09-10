import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularLuminanciaMedia,
  calcularVarianzaLaplaciana,
  evaluarBufferImagen,
} from '../lib/image-quality.ts'

// Genera un buffer RGBA sintético para pruebas unitarias sin DOM
function crearBufferRGBA(width, height, fillFn) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const [r, g, b, a = 255] = fillFn(x, y)
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = a
    }
  }
  return { width, height, data }
}

test('image-quality: imagen negra se clasifica como demasiado oscura', () => {
  const blackImg = crearBufferRGBA(640, 480, () => [10, 10, 10])
  const lum = calcularLuminanciaMedia(blackImg)
  assert.equal(lum <= 15, true)

  const diag = evaluarBufferImagen(blackImg)
  assert.equal(diag.problemas.includes('demasiado_oscura'), true)
  assert.equal(diag.esApta, false)
  assert.equal(diag.score <= 0.6, true)
})

test('image-quality: imagen blanca quemada se clasifica como sobreexpuesta', () => {
  const whiteImg = crearBufferRGBA(640, 480, () => [250, 250, 250])
  const lum = calcularLuminanciaMedia(whiteImg)
  assert.equal(lum >= 245, true)

  const diag = evaluarBufferImagen(whiteImg)
  assert.equal(diag.problemas.includes('sobreexpuesta'), true)
  assert.equal(diag.esApta, false)
})

test('image-quality: imagen uniforme sin bordes se clasifica como desenfocada', () => {
  // Gris medio uniforme (sin bordes)
  const flatImg = crearBufferRGBA(640, 480, () => [128, 128, 128])
  const nitidez = calcularVarianzaLaplaciana(flatImg)
  assert.equal(nitidez, 0)

  const diag = evaluarBufferImagen(flatImg)
  assert.equal(diag.problemas.includes('desenfocada'), true)
  assert.equal(diag.esApta, false)
})

test('image-quality: imagen con textura/bordes contrastados pasa como apta con alto score', () => {
  // Patrón ajedrezado con bordes definidos simulando etiqueta de código de barras
  const sharpImg = crearBufferRGBA(640, 480, (x, y) => {
    const isStripe = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0
    return isStripe ? [210, 210, 210] : [40, 40, 40]
  })

  const lum = calcularLuminanciaMedia(sharpImg)
  const nitidez = calcularVarianzaLaplaciana(sharpImg)
  assert.equal(lum >= 100 && lum <= 150, true)
  assert.equal(nitidez > 20, true)

  const diag = evaluarBufferImagen(sharpImg)
  assert.equal(diag.esApta, true)
  assert.equal(diag.score >= 0.85, true)
  assert.equal(diag.problemas.length, 0)
})

test('image-quality: detecta imágenes con resolución insuficiente', () => {
  const tinyImg = crearBufferRGBA(200, 150, () => [120, 120, 120])
  const diag = evaluarBufferImagen(tinyImg)
  assert.equal(diag.problemas.includes('baja_resolucion'), true)
})
