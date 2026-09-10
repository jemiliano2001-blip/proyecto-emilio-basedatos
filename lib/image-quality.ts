/**
 * Motor de validación de calidad de imágenes para Proyecto Emilio.
 * Evalúa iluminación media (luminancia), nitidez (Varianza Laplaciana) y resolución
 * en tiempo real para alertar al personal en obra antes de enviar evidencias borrosas u oscuras.
 */

export type ProblemaCalidadImagen =
  | 'demasiado_oscura'
  | 'sobreexpuesta'
  | 'desenfocada'
  | 'baja_resolucion'

export interface DiagnosticoCalidadImagen {
  esApta: boolean
  score: number // 0.00 a 1.00
  luminanciaMedia: number // 0 a 255
  nitidezVarianza: number // Varianza Laplaciana
  ancho: number
  alto: number
  resolucionPx: string
  problemas: ProblemaCalidadImagen[]
  mensajes: string[]
}

export interface PixelBufferLike {
  width: number
  height: number
  data: Uint8ClampedArray | Uint8Array | number[]
}

/**
 * Calcula la luminancia promedio (Y) de una muestra de píxeles RGB.
 * Y = 0.299*R + 0.587*G + 0.114*B
 */
export function calcularLuminanciaMedia(pixels: PixelBufferLike): number {
  const { data, width, height } = pixels
  const totalPixels = width * height
  if (totalPixels === 0) return 0

  let sumaLuminancia = 0
  // Paso de muestreo para optimizar rendimiento en imágenes grandes
  const paso = totalPixels > 100000 ? 4 : 1
  let muestras = 0

  for (let i = 0; i < data.length; i += 4 * paso) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    sumaLuminancia += lum
    muestras++
  }

  return muestras > 0 ? Math.round(sumaLuminancia / muestras) : 0
}

/**
 * Calcula la nitidez mediante la Varianza Laplaciana sobre la versión en escala de grises.
 * Un valor bajo indica desenfoque o movimiento; un valor alto indica bordes nítidos.
 */
export function calcularVarianzaLaplaciana(pixels: PixelBufferLike): number {
  const { data, width, height } = pixels
  if (width < 3 || height < 3) return 0

  // 1. Convertir a matriz 1D de escala de grises
  const grises = new Float32Array(width * height)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    grises[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }

  // 2. Convolución con núcleo Laplaciano 3x3:
  // [  0,  1,  0 ]
  // [  1, -4,  1 ]
  // [  0,  1,  0 ]
  let suma = 0
  let sumaCuadrados = 0
  let totalBordes = 0

  // Muestreo con paso para acelerar cálculo en móviles
  const pasoY = height > 600 ? 2 : 1
  const pasoX = width > 600 ? 2 : 1

  for (let y = 1; y < height - 1; y += pasoY) {
    const filaArr = (y - 1) * width
    const filaAct = y * width
    const filaAba = (y + 1) * width

    for (let x = 1; x < width - 1; x += pasoX) {
      const lap =
        grises[filaArr + x] +
        grises[filaAct + (x - 1)] -
        4 * grises[filaAct + x] +
        grises[filaAct + (x + 1)] +
        grises[filaAba + x]

      suma += lap
      sumaCuadrados += lap * lap
      totalBordes++
    }
  }

  if (totalBordes === 0) return 0
  const media = suma / totalBordes
  const varianza = sumaCuadrados / totalBordes - media * media
  return Math.max(0, Math.round(varianza * 10) / 10)
}

/**
 * Analiza un búfer de píxeles y genera un diagnóstico completo con score de calidad.
 */
export function evaluarBufferImagen(pixels: PixelBufferLike): DiagnosticoCalidadImagen {
  const { width, height } = pixels
  const luminancia = calcularLuminanciaMedia(pixels)
  const nitidez = calcularVarianzaLaplaciana(pixels)
  const problemas: ProblemaCalidadImagen[] = []
  const mensajes: string[] = []

  // Criterio de iluminación
  if (luminancia < 35) {
    problemas.push('demasiado_oscura')
    mensajes.push('Fotografía con muy poca luz. Enciende el flash o busca mejor iluminación.')
  } else if (luminancia > 235) {
    problemas.push('sobreexpuesta')
    mensajes.push('Fotografía sobreexpuesta o con reflejo excesivo de luz.')
  }

  // Criterio de nitidez (umbral calibrado para cámaras de teléfonos en obra)
  const umbralNitidezMinima = 15.0
  if (nitidez < umbralNitidezMinima && luminancia >= 35 && luminancia <= 235) {
    problemas.push('desenfocada')
    mensajes.push('Fotografía desenfocada o movida. Mantén el teléfono firme al capturar.')
  }

  // Criterio de resolución
  const dimMenor = Math.min(width, height)
  if (dimMenor < 480) {
    problemas.push('baja_resolucion')
    mensajes.push('Resolución baja. Se recomienda un mínimo de 640x480 para leer etiquetas.')
  }

  // Puntuación compuesta (0.0 a 1.0)
  let score = 1.0
  if (problemas.includes('demasiado_oscura')) score -= 0.4
  if (problemas.includes('sobreexpuesta')) score -= 0.35
  if (problemas.includes('desenfocada')) score -= 0.35
  if (problemas.includes('baja_resolucion')) score -= 0.2

  score = Math.max(0.1, Math.min(1.0, Math.round(score * 100) / 100))
  const esApta = problemas.length === 0 || (problemas.length === 1 && problemas[0] === 'baja_resolucion')

  if (esApta && mensajes.length === 0) {
    mensajes.push('Calidad de imagen óptima para registro de evidencias.')
  }

  return {
    esApta,
    score,
    luminanciaMedia: luminancia,
    nitidezVarianza: nitidez,
    ancho: width,
    alto: height,
    resolucionPx: `${width}x${height}`,
    problemas,
    mensajes,
  }
}

/**
 * Evalúa un archivo de imagen en el navegador mediante HTMLCanvasElement.
 */
export async function analizarCalidadArchivoImagen(
  file: File,
  maxDimensionPrueba = 800
): Promise<DiagnosticoCalidadImagen> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return {
      esApta: true,
      score: 1.0,
      luminanciaMedia: 128,
      nitidezVarianza: 50,
      ancho: 0,
      alto: 0,
      resolucionPx: '0x0',
      problemas: [],
      mensajes: ['Archivo no analizable en servidor.'],
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        let w = img.width
        let h = img.height

        // Escalar temporalmente para que la convolución sea ultra-rápida en CPU móvil
        if (w > maxDimensionPrueba || h > maxDimensionPrueba) {
          if (w > h) {
            h = Math.round((h * maxDimensionPrueba) / w)
            w = maxDimensionPrueba
          } else {
            w = Math.round((w * maxDimensionPrueba) / h)
            h = maxDimensionPrueba
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve({
            esApta: true,
            score: 1.0,
            luminanciaMedia: 128,
            nitidezVarianza: 50,
            ancho: img.width,
            alto: img.height,
            resolucionPx: `${img.width}x${img.height}`,
            problemas: [],
            mensajes: [],
          })
          return
        }

        ctx.drawImage(img, 0, 0, w, h)
        const imgData = ctx.getImageData(0, 0, w, h)
        const diag = evaluarBufferImagen({
          width: w,
          height: h,
          data: imgData.data,
        })

        // Devolver las dimensiones reales originales en los metadatos
        resolve({
          ...diag,
          ancho: img.width,
          alto: img.height,
          resolucionPx: `${img.width}x${img.height}`,
        })
      }

      img.onerror = () => {
        resolve({
          esApta: false,
          score: 0.1,
          luminanciaMedia: 0,
          nitidezVarianza: 0,
          ancho: 0,
          alto: 0,
          resolucionPx: '0x0',
          problemas: ['demasiado_oscura'],
          mensajes: ['No se pudo decodificar la imagen.'],
        })
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      resolve({
        esApta: false,
        score: 0.1,
        luminanciaMedia: 0,
        nitidezVarianza: 0,
        ancho: 0,
        alto: 0,
        resolucionPx: '0x0',
        problemas: ['demasiado_oscura'],
        mensajes: ['Error al leer el archivo de imagen.'],
      })
    }

    reader.readAsDataURL(file)
  })
}
