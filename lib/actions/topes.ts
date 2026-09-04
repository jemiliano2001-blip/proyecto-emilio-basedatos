'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarTopes } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateTopeInput } from '@/lib/validations/tope'

export type ActionResult = { error: string | null; ok?: boolean }

export async function createTopeAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarTopes(session.rol)) {
    return { error: 'No tienes permiso para definir topes contratados.' }
  }

  const parsed = validateTopeInput({
    obra_id: formData.get('obra_id'),
    material_id: formData.get('material_id'),
    cantidad_contratada: formData.get('cantidad_contratada'),
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const supabase = createClient()
  const { error } = await supabase.from('obra_material_contratado').insert(parsed.data)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ese material ya tiene tope en esta obra. Edítalo en la lista.' }
    }
    return { error: 'No se pudo guardar el tope. Intenta de nuevo.' }
  }

  revalidatePath(`/obras/${parsed.data.obra_id}`)
  redirect(`/obras/${parsed.data.obra_id}`)
}

export async function updateTopeAction(
  topeId: string,
  obraId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarTopes(session.rol)) {
    return { error: 'No tienes permiso para editar topes contratados.' }
  }

  const parsed = validateTopeInput({
    obra_id: obraId,
    material_id: formData.get('material_id'),
    cantidad_contratada: formData.get('cantidad_contratada'),
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('obra_material_contratado')
    .update({ cantidad_contratada: parsed.data.cantidad_contratada })
    .eq('id', topeId)
    .eq('obra_id', obraId)

  if (error) {
    return { error: 'No se pudo actualizar el tope. Intenta de nuevo.' }
  }

  revalidatePath(`/obras/${obraId}`)
  return { error: null, ok: true }
}

export async function asignarMaterialesMasivosAction(
  obraId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarTopes(session.rol)) {
    return { error: 'No tienes permiso para asignar materiales al proyecto.' }
  }

  const partidasRaw = formData.get('partidas_json')
  if (typeof partidasRaw !== 'string' || partidasRaw.trim() === '') {
    return { error: 'No se encontraron partidas para asignar.' }
  }

  let partidas: { material_id: string; cantidad: number }[] = []
  try {
    const parsed = JSON.parse(partidasRaw)
    if (!Array.isArray(parsed)) throw new Error('Formato inválido')
    partidas = parsed
      .filter((p) => p && typeof p.material_id === 'string' && Number(p.cantidad) > 0)
      .map((p) => ({
        material_id: String(p.material_id).trim(),
        cantidad: Number(p.cantidad),
      }))
  } catch {
    return { error: 'Error al interpretar los materiales asignados.' }
  }

  if (partidas.length === 0) {
    return { error: 'Agrega al menos un material con cantidad mayor a 0.' }
  }

  const supabase = createClient()

  // 1. Obtener precios base de los materiales para cálculo de presupuesto adicional
  const matIds = partidas.map((p) => p.material_id)
  const { data: mats } = await supabase
    .from('catalogo_materiales')
    .select('id, precio_base')
    .in('id', matIds)

  const priceMap = new Map((mats ?? []).map((m) => [m.id, Number(m.precio_base ?? 0)]))
  let costoAdicional = 0

  for (const p of partidas) {
    const pb = priceMap.get(p.material_id) ?? 0
    costoAdicional += p.cantidad * pb
  }
  costoAdicional = Math.round(costoAdicional * 100) / 100

  // 2. Obtener asignaciones existentes en esta obra
  const { data: existentes } = await supabase
    .from('obra_material_contratado')
    .select('id, material_id, cantidad_contratada')
    .eq('obra_id', obraId)
    .in('material_id', matIds)

  const existentesMap = new Map(
    (existentes ?? []).map((e) => [e.material_id, { id: e.id, cantidad: Number(e.cantidad_contratada) }])
  )

  // 3. Upsert o insert según corresponda
  for (const p of partidas) {
    const existente = existentesMap.get(p.material_id)
    if (existente) {
      const nuevaCantidad = existente.cantidad + p.cantidad
      const { error: errUpd } = await supabase
        .from('obra_material_contratado')
        .update({ cantidad_contratada: nuevaCantidad })
        .eq('id', existente.id)

      if (errUpd) {
        return { error: 'Error al actualizar material existente.' }
      }
    } else {
      const { error: errIns } = await supabase
        .from('obra_material_contratado')
        .insert({
          obra_id: obraId,
          material_id: p.material_id,
          cantidad_contratada: p.cantidad,
        })

      if (errIns) {
        return { error: 'Error al insertar nuevo material asignado.' }
      }
    }
  }

  // 4. Sumar el costo al presupuesto del proyecto si costoAdicional > 0
  if (costoAdicional > 0) {
    const { data: obraActual } = await supabase
      .from('obras')
      .select('presupuesto_mxn')
      .eq('id', obraId)
      .single()

    const presActual = Number(obraActual?.presupuesto_mxn ?? 0)
    await supabase
      .from('obras')
      .update({ presupuesto_mxn: presActual + costoAdicional })
      .eq('id', obraId)
  }

  revalidatePath(`/obras/${obraId}`)
  revalidatePath('/')
  redirect(`/obras/${obraId}`)
}
