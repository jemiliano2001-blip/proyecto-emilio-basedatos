import { detectTipoArchivo } from '@/lib/validations/factura_oc'

/** Tope de la app. El archivo no pasa por el Server Action (límite de 1 MB). */
export const LIMITE_FACTURA_BYTES = 30 * 1024 * 1024

/** El flujo directo tiene que aceptar al menos esto. */
export const MINIMO_FACTURA_BYTES = 10 * 1024 * 1024

export const BUCKET_FACTURAS_OC = 'obra-documentos'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ArchivoMeta = {
  name: string
  type: string
  size: number
}

export type TipoVistaPrevia = 'imagen' | 'pdf' | 'xml' | 'ninguna'

export type ValidacionArchivo =
  | { ok: true; tipo: 'pdf' | 'imagen' | 'xml' }
  | { ok: false; error: string }

export type PrepararFacturaInput = {
  orden_id: string
  nombre: string
  tipo: string
  tamano: number
}

export type PrepararFacturaResult =
  | { error: string; path?: undefined }
  | { error: null; path: string; tipo: 'pdf' | 'imagen' | 'xml' }

export type ResultadoSubida =
  | { ok: true }
  | { ok: false; error: string }

export type ResultadoPegado = {
  adjuntado: boolean
  archivo: ArchivoMeta | null
  error: string | null
}

type Portapapeles<T extends ArchivoMeta> = {
  files?: ArrayLike<T> | null
  items?: ArrayLike<{ kind: string; getAsFile?: () => T | null }> | null
}

export function validarArchivoFactura(archivo: ArchivoMeta): ValidacionArchivo {
  if (!archivo.name.trim()) {
    return { ok: false, error: 'Selecciona un archivo válido (PDF, foto o XML).' }
  }
  if (!Number.isFinite(archivo.size) || archivo.size <= 0) {
    return { ok: false, error: 'Selecciona un archivo válido (PDF, foto o XML).' }
  }
  if (archivo.size > LIMITE_FACTURA_BYTES) {
    return { ok: false, error: 'El archivo pesa más de 30 MB.' }
  }
  const tipo = detectTipoArchivo(archivo.name, archivo.type || '')
  if (tipo !== 'pdf' && tipo !== 'imagen' && tipo !== 'xml') {
    return { ok: false, error: 'Solo PDF, foto (JPG, PNG, WEBP) o XML.' }
  }
  return { ok: true, tipo }
}

export function tipoVistaPrevia(archivo: Pick<ArchivoMeta, 'name' | 'type'>): TipoVistaPrevia {
  const tipo = detectTipoArchivo(archivo.name, archivo.type || '')
  if (tipo === 'pdf' || tipo === 'imagen' || tipo === 'xml') return tipo
  return 'ninguna'
}

export function rutaFacturaDeOrden(ordenId: string, path: string): boolean {
  if (!UUID_RE.test(ordenId)) return false
  const limpio = path.trim()
  const prefijo = `ordenes/${ordenId}/facturas/`
  if (!limpio.startsWith(prefijo)) return false
  const resto = limpio.slice(prefijo.length)
  if (!resto || resto.includes('/') || resto.includes('\\') || resto.includes('..')) return false
  if (resto.includes('\0')) return false
  return true
}

export function archivoDesdePortapapeles<T extends ArchivoMeta>(
  data: Portapapeles<T> | null
): T | null {
  if (!data) return null
  if (data.files && data.files.length > 0) {
    return data.files[0] ?? null
  }
  if (!data.items) return null
  for (let i = 0; i < data.items.length; i += 1) {
    const item = data.items[i]
    if (item && item.kind === 'file' && item.getAsFile) {
      const archivo = item.getAsFile()
      if (archivo) return archivo
    }
  }
  return null
}

/**
 * Ctrl+V (o el evento paste, que es ese atajo). Si hay un archivo, se adjunta.
 * El texto plano no se convierte en adjunto.
 */
export function adjuntarDesdeCtrlV<T extends ArchivoMeta>(evento: {
  key?: string
  ctrlKey?: boolean
  metaKey?: boolean
  clipboardData: Portapapeles<T> | null
}): { adjuntado: boolean; archivo: T | null; error: string | null } {
  if (evento.key != null) {
    const tecla = evento.key.toLowerCase()
    const conModificador = evento.ctrlKey === true || evento.metaKey === true
    if (tecla !== 'v' || !conModificador) {
      return { adjuntado: false, archivo: null, error: null }
    }
  }
  const archivo = archivoDesdePortapapeles(evento.clipboardData)
  if (!archivo) return { adjuntado: false, archivo: null, error: null }
  const validacion = validarArchivoFactura(archivo)
  if (!validacion.ok) return { adjuntado: false, archivo: null, error: validacion.error }
  return { adjuntado: true, archivo, error: null }
}

export async function subirFacturaDirecto<T extends ArchivoMeta>(args: {
  archivo: T
  ordenId: string
  obraId: string
  folio?: string
  monto?: string
  itemIds: readonly string[]
  preparar: (input: PrepararFacturaInput) => Promise<PrepararFacturaResult>
  storage: {
    upload: (
      path: string,
      archivo: T,
      opciones: { contentType: string; upsert: false }
    ) => Promise<{ error: { message: string } | null }>
  }
  registrar: (formData: FormData) => Promise<{ error: string | null }>
}): Promise<ResultadoSubida> {
  const validacion = validarArchivoFactura(args.archivo)
  if (!validacion.ok) return { ok: false, error: validacion.error }

  let preparado: PrepararFacturaResult
  try {
    preparado = await args.preparar({
      orden_id: args.ordenId,
      nombre: args.archivo.name,
      tipo: args.archivo.type,
      tamano: args.archivo.size,
    })
  } catch {
    return { ok: false, error: 'No se pudo preparar la subida. Inténtalo otra vez.' }
  }
  if (preparado.error || !preparado.path) {
    return { ok: false, error: preparado.error || 'No se pudo preparar la subida.' }
  }
  if (!rutaFacturaDeOrden(args.ordenId, preparado.path)) {
    return { ok: false, error: 'La ruta de la factura no es válida.' }
  }

  let subida: { error: { message: string } | null }
  try {
    subida = await args.storage.upload(preparado.path, args.archivo, {
      contentType: args.archivo.type || 'application/octet-stream',
      upsert: false,
    })
  } catch {
    return { ok: false, error: 'No se pudo subir el archivo. Revisa tu señal e inténtalo otra vez.' }
  }
  if (subida.error) {
    const detalle = subida.error.message.toLowerCase()
    if (detalle.includes('payload') || detalle.includes('too large') || detalle.includes('maximum') || detalle.includes('size')) {
      return { ok: false, error: 'El archivo pesa más de lo que acepta el almacén.' }
    }
    if (
      detalle.includes('policy') ||
      detalle.includes('row-level') ||
      detalle.includes('unauthorized') ||
      detalle.includes('not allowed') ||
      detalle.includes('403')
    ) {
      return { ok: false, error: 'No tienes permiso para guardar este archivo en el proyecto.' }
    }
    return { ok: false, error: 'No se pudo subir el archivo. Revisa tu señal e inténtalo otra vez.' }
  }

  const fd = new FormData()
  fd.append('orden_id', args.ordenId)
  fd.append('obra_id', args.obraId)
  fd.append('archivo_path', preparado.path)
  fd.append('archivo_nombre', args.archivo.name)
  fd.append('archivo_tipo', args.archivo.type || '')
  fd.append('tamano_bytes', String(args.archivo.size))
  if (args.folio && args.folio.trim()) fd.append('folio_factura', args.folio.trim())
  if (args.monto && args.monto.trim()) fd.append('monto_factura', args.monto.trim())
  for (const id of args.itemIds) fd.append('item_ids', id)

  let registro: { error: string | null }
  try {
    registro = await args.registrar(fd)
  } catch {
    return { ok: false, error: 'No se pudo guardar la factura. Inténtalo otra vez.' }
  }
  if (registro.error) return { ok: false, error: registro.error }
  return { ok: true }
}
