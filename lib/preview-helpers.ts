/**
 * Detección de tipo para la vista previa. Portado del Hub (`lib/preview-helpers.ts`,
 * commit 864a457) sin el visor negro ni la impresión por document.write.
 */

export type TipoArchivoPreview =
  | 'image'
  | 'pdf'
  | 'csv'
  | 'xml'
  | 'text'
  | 'spreadsheet'
  | 'generic'

export function detectarTipoArchivo(urlOrNombre: string, mimeType?: string): TipoArchivoPreview {
  const mime = mimeType?.toLowerCase() || ''
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'text/csv' || mime.includes('csv')) return 'csv'
  if (mime === 'text/xml' || mime === 'application/xml') return 'xml'
  if (mime.startsWith('text/')) return 'text'
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('vnd.ms-excel') ||
    mime.includes('openxmlformats-officedocument.spreadsheetml')
  ) {
    return 'spreadsheet'
  }

  if (urlOrNombre.startsWith('data:image/')) return 'image'
  if (urlOrNombre.startsWith('data:application/pdf')) return 'pdf'
  if (urlOrNombre.startsWith('data:text/xml')) return 'xml'
  if (urlOrNombre.startsWith('data:text/csv')) return 'csv'

  const urlLimpia = urlOrNombre.split('?')[0].split('#')[0].toLowerCase()

  if (/\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)$/i.test(urlLimpia)) return 'image'
  if (/\.pdf$/i.test(urlLimpia)) return 'pdf'
  if (/\.csv$/i.test(urlLimpia)) return 'csv'
  if (/\.xml$/i.test(urlLimpia)) return 'xml'
  if (/\.(txt|log|md|json|yaml|yml)$/i.test(urlLimpia)) return 'text'
  if (/\.(xlsx|xls)$/i.test(urlLimpia)) return 'spreadsheet'

  return 'generic'
}

export function obtenerExtensionArchivo(urlOrNombre: string): string {
  if (!urlOrNombre) return ''
  if (urlOrNombre.startsWith('data:image/jpeg')) return 'jpg'
  if (urlOrNombre.startsWith('data:image/png')) return 'png'
  if (urlOrNombre.startsWith('data:image/webp')) return 'webp'
  if (urlOrNombre.startsWith('data:application/pdf')) return 'pdf'

  const urlLimpia = urlOrNombre.split('?')[0].split('#')[0]
  const partes = urlLimpia.split('.')
  if (partes.length > 1) {
    const ext = partes.pop()?.toLowerCase() || ''
    if (ext.length <= 5) return ext
  }
  return ''
}

export function obtenerNombreArchivo(url: string, nombreSugerido?: string): string {
  if (nombreSugerido && nombreSugerido.trim()) return nombreSugerido.trim()

  if (url.startsWith('data:')) {
    const tipo = detectarTipoArchivo(url)
    return `archivo-preview.${tipo === 'image' ? 'jpg' : tipo === 'pdf' ? 'pdf' : 'dat'}`
  }

  try {
    const urlLimpia = url.split('?')[0].split('#')[0]
    const nombre = urlLimpia.split('/').pop()
    if (nombre && decodeURIComponent(nombre).trim()) return decodeURIComponent(nombre).trim()
  } catch {
    // Nombre ilegible en la URL.
  }

  return 'archivo'
}

/** Tope de filas de la vista previa, igual que el Hub. */
export function parsearCsvSimple(textoCsv: string): { cabeceras: string[]; filas: string[][] } {
  if (!textoCsv || !textoCsv.trim()) return { cabeceras: [], filas: [] }

  const lineas = textoCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lineas.length === 0) return { cabeceras: [], filas: [] }

  const parsearLinea = (linea: string): string[] => {
    const resultado: string[] = []
    let actual = ''
    let enComillas = false

    for (let i = 0; i < linea.length; i += 1) {
      const char = linea[i]
      if (char === '"') {
        enComillas = !enComillas
      } else if ((char === ',' || char === ';') && !enComillas) {
        resultado.push(actual.trim().replace(/^"|"$/g, ''))
        actual = ''
      } else {
        actual += char
      }
    }
    resultado.push(actual.trim().replace(/^"|"$/g, ''))
    return resultado
  }

  const cabeceras = parsearLinea(lineas[0])
  const filas = lineas.slice(1, 101).map(parsearLinea)
  return { cabeceras, filas }
}
