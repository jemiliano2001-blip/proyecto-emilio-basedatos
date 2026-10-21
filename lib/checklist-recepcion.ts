import { roundQuantity } from '@/lib/money'
import type { EstadoRecepcionItem, OrdenItemChecklist } from '@/lib/types'
import type { ArchivoMeta, ValidacionArchivo } from '@/lib/adjuntos'

/** Misma foto que ya acepta la recepción: imagen, máximo 10 MB. */
export const LIMITE_FOTO_RECEPCION_BYTES = 10 * 1024 * 1024

export const MENSAJE_FALTA_REVISAR = 'Falta revisar unos materiales.'
export const MENSAJE_FALTA_CANTIDAD = 'Escribe cuántos llegaron.'
export const MENSAJE_FALTA_FOTO_MAL = 'Falta la foto de lo que llegó mal.'
export const MENSAJE_FALTA_TALON = 'Falta la foto del talón.'
export const MENSAJE_CANTIDAD_MAYOR = 'La cantidad no puede ser mayor a lo pedido.'
export const MENSAJE_NADA_LLEGO = 'Si no llegó nada, toca No llegó.'
export const MENSAJE_TODO_BIEN = 'Si llegó todo bien, toca Llegó.'
export const MENSAJE_SIN_MATERIAL = 'Este pedido ya no tiene material por recibir.'
export const MENSAJE_BORRADOR_GRANDE =
  'No se pudo guardar en el teléfono. La foto es muy grande.'
export const MENSAJE_SIN_SENAL =
  'Sin señal: se guarda en el teléfono y se manda después.'
export const MENSAJE_FOTO_TIPO =
  'La foto tiene que ser una imagen (JPG, PNG o WebP).'
export const MENSAJE_FOTO_TAMANO = 'La foto es muy grande. Usa una de menos de 10 MB.'
export const MENSAJE_FOTO_VACIA = 'Esa foto está vacía. Toma otra.'

export const CLASE_BOTON_GRANDE =
  'flex min-h-14 w-full items-center justify-center rounded-xl px-4 text-base font-semibold'

export type MarcaChecklist = 'llego' | 'incompleto' | 'no_llego'
export type PasoChecklist = 2 | 3 | 4
export type GrupoResumen = 'llego' | 'falta' | 'danado'

export interface MaterialChecklist {
  orden_item_id: string
  nombre: string
  unidad: string
  esperado: number
}

export interface RenglonChecklist {
  orden_item_id: string
  marca: MarcaChecklist | null
  bien: number | null
  rotos: number | null
  nota: string
  tieneFoto: boolean
}

export interface FotoBorrador {
  nombre: string
  tipo: string
  base64: string
}

export interface RenglonBorrador {
  orden_item_id: string
  marca: MarcaChecklist | null
  bien: number | null
  rotos: number | null
  nota: string
  foto: FotoBorrador | null
}

export interface BorradorChecklist {
  version: 1
  ordenId: string
  paso: PasoChecklist
  recepcionId: string
  quienEntrego: string
  pendienteEnvio: boolean
  renglones: RenglonBorrador[]
  talon: FotoBorrador | null
  extras: FotoBorrador[]
}

export interface AlmacenBorrador {
  leer(clave: string): string | null
  guardar(clave: string, valor: string): void
  borrar(clave: string): void
}

export interface ItemRecepcionListo {
  orden_item_id: string
  cantidad_recibida: number
  cantidad_danada: number
  estado: EstadoRecepcionItem
  observacion: string | null
}

export interface LineaResumen {
  orden_item_id: string
  nombre: string
  grupo: GrupoResumen
  texto: string
}

const MARCAS: readonly MarcaChecklist[] = ['llego', 'incompleto', 'no_llego']
const PASOS: readonly PasoChecklist[] = [2, 3, 4]

export function claveBorrador(ordenId: string): string {
  return `checklist-recepcion:${ordenId}`
}

export function validarFotoRecepcion(archivo: ArchivoMeta): ValidacionArchivo {
  const tipo = (archivo.type || '').toLowerCase()
  const nombre = archivo.name.toLowerCase()
  const esImagen =
    tipo.startsWith('image/') ||
    nombre.endsWith('.jpg') ||
    nombre.endsWith('.jpeg') ||
    nombre.endsWith('.png') ||
    nombre.endsWith('.webp') ||
    nombre.endsWith('.gif')
  if (!esImagen) return { ok: false, error: MENSAJE_FOTO_TIPO }
  if (!Number.isFinite(archivo.size) || archivo.size <= 0) {
    return { ok: false, error: MENSAJE_FOTO_VACIA }
  }
  if (archivo.size > LIMITE_FOTO_RECEPCION_BYTES) {
    return { ok: false, error: MENSAJE_FOTO_TAMANO }
  }
  return { ok: true, tipo: 'imagen' }
}

export function etiquetaLlegadaPedido(estado: string): string {
  if (estado === 'parcialmente_recibida') return 'Llegó una parte'
  return 'Por recibir'
}

export function cantidadTexto(valor: number, unidad: string): string {
  const n = roundQuantity(valor)
  const num = Number.isInteger(n) ? n.toFixed(0) : String(n)
  const u = unidad.trim()
  return u ? `${num} ${u}` : num
}

export function textoContador(revisados: number, total: number): string {
  return `${revisados} de ${total} revisados`
}

export function pasoDe(esperado: number): number {
  return Number.isInteger(roundQuantity(esperado)) ? 1 : 0.5
}

export function moverCantidad(actual: number | null, delta: number, tope: number): number {
  const base = actual ?? 0
  const siguiente = roundQuantity(Math.max(0, base + delta))
  const max = roundQuantity(Math.max(0, tope))
  return siguiente > max ? max : siguiente
}

export function noLlegaron(esperado: number, bien: number, rotos: number): number {
  return roundQuantity(Math.max(0, esperado - bien - rotos))
}

export function materialesPorRecibir(items: OrdenItemChecklist[]): MaterialChecklist[] {
  return items
    .filter((item) => Number(item.pendiente) > 0)
    .map((item) => {
      const variante = item.variante?.trim()
      return {
        orden_item_id: item.orden_item_id,
        nombre: variante ? `${item.nombre_base} (${variante})` : item.nombre_base,
        unidad: item.unidad_medida,
        esperado: roundQuantity(Number(item.pendiente)),
      }
    })
}

export function renglonVacio(ordenItemId: string): RenglonChecklist {
  return {
    orden_item_id: ordenItemId,
    marca: null,
    bien: null,
    rotos: null,
    nota: '',
    tieneFoto: false,
  }
}

function esMarca(valor: unknown): valor is MarcaChecklist {
  return typeof valor === 'string' && MARCAS.includes(valor as MarcaChecklist)
}

function numeroONull(valor: unknown): number | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null
  return roundQuantity(valor)
}

export function revisarIncompleto(
  esperado: number,
  bien: number | null,
  rotos: number | null,
  tieneFoto: boolean
):
  | { ok: true; bien: number; rotos: number; faltan: number; estado: EstadoRecepcionItem }
  | { ok: false; error: string } {
  if (bien === null || rotos === null) return { ok: false, error: MENSAJE_FALTA_CANTIDAD }
  if (bien < 0 || rotos < 0) return { ok: false, error: MENSAJE_FALTA_CANTIDAD }
  const buenos = roundQuantity(bien)
  const rotas = roundQuantity(rotos)
  const pedido = roundQuantity(esperado)
  if (buenos + rotas > pedido) return { ok: false, error: MENSAJE_CANTIDAD_MAYOR }
  if (buenos + rotas === 0) return { ok: false, error: MENSAJE_NADA_LLEGO }
  if (buenos === pedido && rotas === 0) return { ok: false, error: MENSAJE_TODO_BIEN }
  if (!tieneFoto) return { ok: false, error: MENSAJE_FALTA_FOTO_MAL }
  return {
    ok: true,
    bien: buenos,
    rotos: rotas,
    faltan: noLlegaron(pedido, buenos, rotas),
    estado: rotas > 0 ? 'danado' : 'parcial',
  }
}

export function estaRevisado(material: MaterialChecklist, renglon: RenglonChecklist): boolean {
  if (renglon.orden_item_id !== material.orden_item_id) return false
  if (renglon.marca === 'llego' || renglon.marca === 'no_llego') return true
  if (renglon.marca === 'incompleto') {
    return revisarIncompleto(material.esperado, renglon.bien, renglon.rotos, renglon.tieneFoto).ok
  }
  return false
}

export function contarRevisados(
  materiales: MaterialChecklist[],
  renglones: RenglonChecklist[]
): { revisados: number; total: number; texto: string } {
  const total = materiales.length
  const porId = new Map(renglones.map((r) => [r.orden_item_id, r]))
  let revisados = 0
  for (const material of materiales) {
    const renglon = porId.get(material.orden_item_id) ?? renglonVacio(material.orden_item_id)
    if (estaRevisado(material, renglon)) revisados += 1
  }
  return { revisados, total, texto: textoContador(revisados, total) }
}

export function errorDeRenglon(
  material: MaterialChecklist,
  renglon: RenglonChecklist
): string | null {
  if (renglon.marca !== 'incompleto') return null
  const revision = revisarIncompleto(
    material.esperado,
    renglon.bien,
    renglon.rotos,
    renglon.tieneFoto
  )
  return revision.ok ? null : revision.error
}

export function motivoMateriales(
  materiales: MaterialChecklist[],
  renglones: RenglonChecklist[]
): string | null {
  if (materiales.length === 0) return MENSAJE_SIN_MATERIAL
  const porId = new Map(renglones.map((r) => [r.orden_item_id, r]))
  for (const material of materiales) {
    const renglon = porId.get(material.orden_item_id) ?? renglonVacio(material.orden_item_id)
    const error = errorDeRenglon(material, renglon)
    if (error) return error
  }
  const cuenta = contarRevisados(materiales, renglones)
  if (cuenta.revisados < cuenta.total) return MENSAJE_FALTA_REVISAR
  return null
}

export function motivoBloqueo(
  materiales: MaterialChecklist[],
  renglones: RenglonChecklist[],
  tieneTalon: boolean
): string | null {
  const materialesError = motivoMateriales(materiales, renglones)
  if (materialesError) return materialesError
  if (!tieneTalon) return MENSAJE_FALTA_TALON
  return null
}

export function puedeTerminar(
  materiales: MaterialChecklist[],
  renglones: RenglonChecklist[],
  tieneTalon: boolean
): boolean {
  return motivoBloqueo(materiales, renglones, tieneTalon) === null
}

function observacionIncompleto(nota: string, rotos: number): string {
  const escrita = nota.trim()
  if (escrita) return escrita
  return rotos > 0 ? 'Llegaron rotas' : 'Llegó incompleto'
}

export function itemDesdeRenglon(
  material: MaterialChecklist,
  renglon: RenglonChecklist
): { ok: true; item: ItemRecepcionListo } | { ok: false; error: string } {
  if (!estaRevisado(material, renglon) || !renglon.marca) {
    const error = errorDeRenglon(material, renglon)
    return { ok: false, error: error ?? MENSAJE_FALTA_REVISAR }
  }
  if (renglon.marca === 'llego') {
    return {
      ok: true,
      item: {
        orden_item_id: material.orden_item_id,
        cantidad_recibida: roundQuantity(material.esperado),
        cantidad_danada: 0,
        estado: 'completo',
        observacion: null,
      },
    }
  }
  if (renglon.marca === 'no_llego') {
    return {
      ok: true,
      item: {
        orden_item_id: material.orden_item_id,
        cantidad_recibida: 0,
        cantidad_danada: 0,
        estado: 'faltante',
        observacion: 'No llegó',
      },
    }
  }
  const revision = revisarIncompleto(
    material.esperado,
    renglon.bien,
    renglon.rotos,
    renglon.tieneFoto
  )
  if (!revision.ok) return revision
  return {
    ok: true,
    item: {
      orden_item_id: material.orden_item_id,
      cantidad_recibida: revision.bien,
      cantidad_danada: revision.rotos,
      estado: revision.estado,
      observacion: observacionIncompleto(renglon.nota, revision.rotos),
    },
  }
}

export function exigeFotoItem(estado: string, cantidadDanada: number): boolean {
  return estado === 'parcial' || estado === 'danado' || cantidadDanada > 0
}

export function resumir(
  materiales: MaterialChecklist[],
  renglones: RenglonChecklist[]
): { llego: LineaResumen[]; falta: LineaResumen[]; danado: LineaResumen[] } {
  const porId = new Map(renglones.map((r) => [r.orden_item_id, r]))
  const llego: LineaResumen[] = []
  const falta: LineaResumen[] = []
  const danado: LineaResumen[] = []
  for (const material of materiales) {
    const renglon = porId.get(material.orden_item_id) ?? renglonVacio(material.orden_item_id)
    if (!estaRevisado(material, renglon) || !renglon.marca) continue
    if (renglon.marca === 'llego') {
      llego.push({
        orden_item_id: material.orden_item_id,
        nombre: material.nombre,
        grupo: 'llego',
        texto: `Llegó ${cantidadTexto(material.esperado, material.unidad)}`,
      })
      continue
    }
    if (renglon.marca === 'no_llego') {
      falta.push({
        orden_item_id: material.orden_item_id,
        nombre: material.nombre,
        grupo: 'falta',
        texto: 'No llegó',
      })
      continue
    }
    const revision = revisarIncompleto(
      material.esperado,
      renglon.bien,
      renglon.rotos,
      true
    )
    if (!revision.ok) continue
    const texto = `${cantidadTexto(revision.bien, material.unidad)} bien, ${cantidadTexto(revision.rotos, material.unidad)} rotos, ${cantidadTexto(revision.faltan, material.unidad)} no llegaron`
    const linea: LineaResumen = {
      orden_item_id: material.orden_item_id,
      nombre: material.nombre,
      grupo: revision.rotos > 0 ? 'danado' : 'falta',
      texto,
    }
    if (linea.grupo === 'danado') danado.push(linea)
    else falta.push(linea)
  }
  return { llego, falta, danado }
}

function fotoValida(valor: unknown): FotoBorrador | null {
  if (typeof valor !== 'object' || valor === null) return null
  const foto = valor as Record<string, unknown>
  if (typeof foto.nombre !== 'string' || typeof foto.tipo !== 'string' || typeof foto.base64 !== 'string') {
    return null
  }
  if (!foto.base64) return null
  return { nombre: foto.nombre, tipo: foto.tipo, base64: foto.base64 }
}

function renglonBorradorValido(valor: unknown): RenglonBorrador | null {
  if (typeof valor !== 'object' || valor === null) return null
  const row = valor as Record<string, unknown>
  if (typeof row.orden_item_id !== 'string' || row.orden_item_id.trim() === '') return null
  const marca = row.marca === null ? null : esMarca(row.marca) ? row.marca : null
  return {
    orden_item_id: row.orden_item_id,
    marca,
    bien: numeroONull(row.bien),
    rotos: numeroONull(row.rotos),
    nota: typeof row.nota === 'string' ? row.nota : '',
    foto: fotoValida(row.foto),
  }
}

export function leerBorrador(almacen: AlmacenBorrador, ordenId: string): BorradorChecklist | null {
  let crudo: string | null
  try {
    crudo = almacen.leer(claveBorrador(ordenId))
  } catch {
    return null
  }
  if (!crudo) return null
  try {
    const parsed = JSON.parse(crudo) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const body = parsed as Record<string, unknown>
    if (body.version !== 1 || body.ordenId !== ordenId) return null
    if (typeof body.recepcionId !== 'string' || body.recepcionId.trim() === '') return null
    if (!PASOS.includes(body.paso as PasoChecklist)) return null
    if (!Array.isArray(body.renglones)) return null
    const renglones: RenglonBorrador[] = []
    for (const row of body.renglones) {
      const renglon = renglonBorradorValido(row)
      if (renglon) renglones.push(renglon)
    }
    const extras: FotoBorrador[] = []
    if (Array.isArray(body.extras)) {
      for (const extra of body.extras) {
        const foto = fotoValida(extra)
        if (foto) extras.push(foto)
      }
    }
    return {
      version: 1,
      ordenId,
      paso: body.paso as PasoChecklist,
      recepcionId: body.recepcionId,
      quienEntrego: typeof body.quienEntrego === 'string' ? body.quienEntrego : '',
      pendienteEnvio: body.pendienteEnvio === true,
      renglones,
      talon: fotoValida(body.talon),
      extras,
    }
  } catch {
    return null
  }
}

export function guardarBorrador(
  almacen: AlmacenBorrador,
  borrador: BorradorChecklist
): { ok: true } | { ok: false; error: string } {
  try {
    almacen.guardar(claveBorrador(borrador.ordenId), JSON.stringify(borrador))
    return { ok: true }
  } catch {
    return { ok: false, error: MENSAJE_BORRADOR_GRANDE }
  }
}

export function borrarBorrador(almacen: AlmacenBorrador, ordenId: string): void {
  try {
    almacen.borrar(claveBorrador(ordenId))
  } catch {
    // Si el teléfono no puede borrar, el siguiente guardado lo reemplaza.
  }
}

export function fusionarRenglones(
  materiales: MaterialChecklist[],
  borrador: BorradorChecklist | null
): RenglonBorrador[] {
  const previos = new Map((borrador?.renglones ?? []).map((r) => [r.orden_item_id, r]))
  return materiales.map((material) => {
    const previo = previos.get(material.orden_item_id)
    if (!previo) {
      return {
        orden_item_id: material.orden_item_id,
        marca: null,
        bien: null,
        rotos: null,
        nota: '',
        foto: null,
      }
    }
    return previo
  })
}

export function aRenglonChecklist(renglon: RenglonBorrador): RenglonChecklist {
  return {
    orden_item_id: renglon.orden_item_id,
    marca: renglon.marca,
    bien: renglon.bien,
    rotos: renglon.rotos,
    nota: renglon.nota,
    tieneFoto: renglon.foto !== null,
  }
}

export function archivoAFoto(bytes: Uint8Array, nombre: string, tipo: string): FotoBorrador {
  let binario = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binario += String.fromCharCode(bytes[i] ?? 0)
  }
  return { nombre, tipo: tipo || 'image/jpeg', base64: btoa(binario) }
}

export function fotoABytes(foto: FotoBorrador): Uint8Array {
  const binario = atob(foto.base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return bytes
}

export async function archivoAFotoFile(file: File): Promise<FotoBorrador> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return archivoAFoto(bytes, file.name || 'foto.jpg', file.type || 'image/jpeg')
}

export function fotoAArchivo(foto: FotoBorrador): File {
  const bytes = fotoABytes(foto)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new File([buffer], foto.nombre, { type: foto.tipo || 'image/jpeg' })
}
