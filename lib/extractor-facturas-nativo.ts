/**
 * Extractor inteligente nativo (SIN IA) para facturas electrónicas y remisiones.
 * Analiza archivos XML CFDI del SAT (versiones 3.3 y 4.0), heurísticas de nombres
 * de archivos y cotejo automático de partidas contra la Orden de Compra.
 */

export interface ConceptoFacturaExtraido {
  descripcion: string
  cantidad: number
  unidad?: string
  valorUnitario?: number
  importe?: number
  claveProdServ?: string
}

export interface DatosFacturaExtraidos {
  esXmlCfdi: boolean
  uuidFiscal?: string | null
  folio?: string | null
  serie?: string | null
  folioCompleto?: string | null
  fecha?: string | null
  emisorNombre?: string | null
  emisorRfc?: string | null
  moneda?: string
  subtotal?: number | null
  total?: number | null
  conceptos: ConceptoFacturaExtraido[]
  confianza: 'exacta_cfdi' | 'heuristica_archivo'
}

/**
 * Parsea el contenido en texto de un archivo XML CFDI (3.3 o 4.0) del SAT.
 * Funciona de forma idéntica en navegador y Node.js sin requerir librerías externas.
 */
export function parsearCfdiXml(xmlTexto: string): DatosFacturaExtraidos | null {
  if (!xmlTexto || typeof xmlTexto !== 'string') return null

  // Verificar si es un XML CFDI del SAT
  const esComprobante = /<[a-zA-Z0-9_:]*Comprobante\b/i.test(xmlTexto)
  if (!esComprobante) return null

  // 1. Extraer atributos principales del Comprobante
  const folioMatch = xmlTexto.match(/\bFolio="([^"]+)"/i)
  const serieMatch = xmlTexto.match(/\bSerie="([^"]+)"/i)
  const totalMatch = xmlTexto.match(/\bTotal="([^"]+)"/i)
  const subtotalMatch = xmlTexto.match(/\bSubTotal="([^"]+)"/i)
  const monedaMatch = xmlTexto.match(/\bMoneda="([^"]+)"/i)
  const fechaMatch = xmlTexto.match(/\bFecha="([^"T]+)(?:T([^"]+))?"/i)

  // 2. Extraer UUID del Timbre Fiscal Digital
  const uuidMatch = xmlTexto.match(/\bUUID="([a-fA-F0-9-]{36})"/i)

  // 3. Extraer Emisor
  const emisorRfcMatch = xmlTexto.match(/<[a-zA-Z0-9_:]*Emisor\b[^>]*\bRfc="([^"]+)"/i)
  const emisorNombreMatch = xmlTexto.match(/<[a-zA-Z0-9_:]*Emisor\b[^>]*\bNombre="([^"]+)"/i)

  // 4. Extraer Conceptos
  const conceptos: ConceptoFacturaExtraido[] = []
  const conceptoRegex = /<[a-zA-Z0-9_:]*Concepto\b([^>]+)\/?>/gi
  let match: RegExpExecArray | null

  while ((match = conceptoRegex.exec(xmlTexto)) !== null) {
    const atributos = match[1]
    const descMatch = atributos.match(/\bDescripcion="([^"]+)"/i)
    const cantMatch = atributos.match(/\bCantidad="([^"]+)"/i)
    const unidadMatch = atributos.match(/\bUnidad="([^"]+)"/i)
    const vuMatch = atributos.match(/\bValorUnitario="([^"]+)"/i)
    const impMatch = atributos.match(/\bImporte="([^"]+)"/i)
    const claveMatch = atributos.match(/\bClaveProdServ="([^"]+)"/i)

    if (descMatch) {
      const rawCant = cantMatch ? parseFloat(cantMatch[1]) : 1
      const cantidad = Number.isFinite(rawCant) ? rawCant : 1

      const rawVu = vuMatch ? parseFloat(vuMatch[1]) : undefined
      const valorUnitario = rawVu !== undefined && Number.isFinite(rawVu) ? rawVu : undefined

      const rawImp = impMatch ? parseFloat(impMatch[1]) : undefined
      const importe = rawImp !== undefined && Number.isFinite(rawImp) ? rawImp : undefined

      conceptos.push({
        descripcion: descMatch[1].trim(),
        cantidad,
        unidad: unidadMatch ? unidadMatch[1].trim() : undefined,
        valorUnitario,
        importe,
        claveProdServ: claveMatch ? claveMatch[1].trim() : undefined,
      })
    }
  }

  const serie = serieMatch ? serieMatch[1].trim() : null
  const folio = folioMatch ? folioMatch[1].trim() : null
  const uuidFiscal = uuidMatch ? uuidMatch[1].trim() : null

  let folioCompleto: string | null = null
  if (serie && folio) {
    folioCompleto = `${serie}-${folio}`
  } else if (folio) {
    folioCompleto = folio
  } else if (uuidFiscal) {
    folioCompleto = uuidFiscal.slice(0, 8).toUpperCase()
  }

  const total = totalMatch ? parseFloat(totalMatch[1]) : null
  const subtotal = subtotalMatch ? parseFloat(subtotalMatch[1]) : null

  return {
    esXmlCfdi: true,
    uuidFiscal,
    folio,
    serie,
    folioCompleto,
    fecha: fechaMatch ? fechaMatch[1] : null,
    emisorNombre: emisorNombreMatch ? emisorNombreMatch[1].trim() : null,
    emisorRfc: emisorRfcMatch ? emisorRfcMatch[1].trim() : null,
    moneda: monedaMatch ? monedaMatch[1].trim() : 'MXN',
    subtotal: Number.isFinite(subtotal) ? subtotal : null,
    total: Number.isFinite(total) ? total : null,
    conceptos,
    confianza: 'exacta_cfdi',
  }
}

/**
 * Analizador heurístico para extraer folio probable y fecha desde el nombre de un archivo
 * (útil para PDFs, imágenes o remisiones capturadas en campo).
 */
export function extraerDatosDesdeNombreArchivo(nombreArchivo: string): {
  folioSugerido: string | null
  fechaSugerida: string | null
} {
  if (!nombreArchivo) return { folioSugerido: null, fechaSugerida: null }

  const base = nombreArchivo.replace(/\.[a-zA-Z0-9]+$/, '')

  // 1. Detección de patrones de Folio / Remisión (ej: REM-1234, FAC-902, F-4912, A-3920, UUID)
  let folioSugerido: string | null = null
  const uuidRegex = /\b([a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12})\b/i
  const uuidMatch = base.match(uuidRegex)
  if (uuidMatch) {
    folioSugerido = uuidMatch[1].slice(0, 8).toUpperCase()
  } else {
    const patronFolio = /(?:^|[^a-zA-Z0-9])((?:FAC(?:TURA)?|REM(?:ISION)?|INV(?:OICE)?|FOLIO|DOC|F|A|B)[_\-\s]*(?:[A-Z]{1,2}[_\-\s]*)?[0-9]{2,8})(?=[^0-9a-zA-Z]|$)/i
    const folioMatch = base.match(patronFolio)
    if (folioMatch && folioMatch[1]) {
      folioSugerido = folioMatch[1].replace(/[\s_]+/g, '-').toUpperCase()
    }
  }

  // 2. Detección de fecha YYYY-MM-DD o DD-MM-YYYY
  let fechaSugerida: string | null = null
  const fechaIsoMatch = base.match(/(?:^|[^0-9a-zA-Z])(202[4-9])[-_](0[1-9]|1[0-2])[-_](0[1-9]|[12][0-9]|3[01])(?=[^0-9a-zA-Z]|$)/)
  if (fechaIsoMatch) {
    fechaSugerida = `${fechaIsoMatch[1]}-${fechaIsoMatch[2]}-${fechaIsoMatch[3]}`
  } else {
    const fechaMxMatch = base.match(/(?:^|[^0-9a-zA-Z])(0[1-9]|[12][0-9]|3[01])[-_](0[1-9]|1[0-2])[-_](202[4-9])(?=[^0-9a-zA-Z]|$)/)
    if (fechaMxMatch) {
      fechaSugerida = `${fechaMxMatch[3]}-${fechaMxMatch[2]}-${fechaMxMatch[1]}`
    }
  }

  return { folioSugerido, fechaSugerida }
}

/**
 * Normaliza un texto para comparación eliminando acentos, puntuación y mayúsculas.
 */
function normalizarTexto(txt: string | null | undefined): string {
  if (!txt || typeof txt !== 'string') return ''
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Coteja los conceptos detectados en la factura contra las partidas de la Orden de Compra.
 * Retorna los IDs de las partidas de la OC que tienen coincidencia semántica.
 */
export function cotejarPartidasConOC(
  conceptosFactura: { descripcion: string; cantidad?: number }[] | null | undefined,
  itemsOC: { id: string; nombre: string; cantidad: number }[] | null | undefined
): {
  itemsCoincidentesIds: string[]
  desglose: { ordenItemId: string; conceptoFactura: string; similitud: number }[]
} {
  const conceptosSeguros = conceptosFactura ?? []
  const itemsSeguros = itemsOC ?? []
  if (!conceptosSeguros.length || !itemsSeguros.length) {
    return { itemsCoincidentesIds: [], desglose: [] }
  }

  const itemsCoincidentes = new Set<string>()
  const desglose: { ordenItemId: string; conceptoFactura: string; similitud: number }[] = []

  for (const concepto of conceptosSeguros) {
    const palabrasConcepto = new Set(
      normalizarTexto(concepto.descripcion)
        .split(' ')
        .filter((p) => p.length >= 3)
    )

    if (palabrasConcepto.size === 0) continue

    let mejorItem: { id: string; nombre: string; similitud: number } | null = null

    for (const itemOC of itemsSeguros) {
      const palabrasOC = normalizarTexto(itemOC.nombre)
        .split(' ')
        .filter((p) => p.length >= 3)

      if (palabrasOC.length === 0) continue

      // Calcular intersección de palabras clave
      let coincidencias = 0
      for (const p of palabrasOC) {
        if (palabrasConcepto.has(p)) {
          coincidencias++
        }
      }

      const similitud = coincidencias / Math.max(palabrasOC.length, 1)

      // Si supera el umbral de coincidencia (al menos 30% o 2 palabras clave)
      if (similitud >= 0.3 || coincidencias >= 2) {
        if (!mejorItem || similitud > mejorItem.similitud) {
          mejorItem = { id: itemOC.id, nombre: itemOC.nombre, similitud }
        }
      }
    }

    if (mejorItem) {
      itemsCoincidentes.add(mejorItem.id)
      desglose.push({
        ordenItemId: mejorItem.id,
        conceptoFactura: concepto.descripcion,
        similitud: Math.round(mejorItem.similitud * 100),
      })
    }
  }

  return {
    itemsCoincidentesIds: Array.from(itemsCoincidentes),
    desglose,
  }
}
