'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { puedeGestionarObras } from '@/lib/roles'
import { esRelacionAusente } from '@/lib/schema-disponible'
import { createClient } from '@/lib/supabase/server'
import { validateObraInput } from '@/lib/validations/obra'

export type ActionResult = { error: string | null; ok?: boolean }

export async function createObraAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarObras(session.rol)) {
    return { error: 'No tienes permiso para crear proyectos.' }
  }

  const parsed = validateObraInput({
    nombre: formData.get('nombre'),
    cliente: formData.get('cliente'),
    ciudad: formData.get('ciudad'),
    fraccionamiento: formData.get('fraccionamiento'),
    paquete: formData.get('paquete'),
    ubicacion: formData.get('ubicacion'),
    estado: formData.get('estado') || 'activa',
    presupuesto_mxn: formData.get('presupuesto_mxn'),
    topes_json: formData.get('topes_json'),
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const supabase = await createClient()
  const { topes, ...obraData } = parsed.data

  // 1. Intentar creación atómica en PostgreSQL (Migración 0016)
  const { data: rpcData, error: rpcError } = await supabase.rpc('crear_proyecto_con_presupuesto', {
    p_datos: obraData,
    p_topes: topes,
  })

  if (!rpcError && typeof rpcData === 'string') {
    revalidatePath('/')
    redirect(`/obras/${rpcData}`)
  }

  // Si falló por una regla de negocio interna de la RPC (y la función sí existe)
  if (rpcError && !esRelacionAusente(rpcError)) {
    logger.error('Error al crear proyecto mediante RPC', { error: rpcError, obraData })
    return {
      error: rpcError.message || 'No se pudo crear el proyecto con su presupuesto. Revisa los datos o contacta al administrador.',
    }
  }

  // 2. Fallback de compatibilidad: si la migración 0016 aún no se ha aplicado en Supabase
  let finalPresupuesto = obraData.presupuesto_mxn

  if (topes.length > 0 && finalPresupuesto === 0) {
    const matIds = topes.map((t) => t.material_id)
    const { data: mats } = await supabase
      .from('catalogo_materiales')
      .select('id, precio_base')
      .in('id', matIds)

    if (mats) {
      const priceMap = new Map(mats.map((m) => [m.id, Number(m.precio_base ?? 0)]))
      finalPresupuesto = topes.reduce((acc, t) => {
        const p = priceMap.get(t.material_id) ?? 0
        return acc + t.cantidad_contratada * p
      }, 0)
      finalPresupuesto = Math.round(finalPresupuesto * 100) / 100
    }
  }

  const { data: createdObra, error: errorInsert } = await supabase
    .from('obras')
    .insert({
      ...obraData,
      presupuesto_mxn: finalPresupuesto,
      cerrado_en: obraData.estado === 'cerrada' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (errorInsert || !createdObra) {
    logger.error('Error al insertar proyecto (fallback directo)', { error: errorInsert, obraData })
    return {
      error: errorInsert?.message || 'No se pudo crear el proyecto. Revisa los datos o contacta al administrador.',
    }
  }

  if (topes.length > 0) {
    const { error: errorTopes } = await supabase.from('obra_material_contratado').insert(
      topes.map((t) => ({
        obra_id: createdObra.id,
        material_id: t.material_id,
        cantidad_contratada: t.cantidad_contratada,
      }))
    )
    if (errorTopes) {
      logger.error('Error al insertar topes de materiales para nuevo proyecto', {
        error: errorTopes,
        obraId: createdObra.id,
      })
      await supabase.from('obras').delete().eq('id', createdObra.id)
      if (errorTopes.code === '23505') {
        return { error: 'Hay materiales duplicados en el presupuesto.' }
      }
      return {
        error: 'No se pudo guardar el presupuesto de materiales. Intenta de nuevo.',
      }
    }
  }

  revalidatePath('/')
  redirect(`/obras/${createdObra.id}`)
}

export async function updateObraAction(
  obraId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarObras(session.rol)) {
    return { error: 'No tienes permiso para editar proyectos.' }
  }

  const parsed = validateObraInput({
    nombre: formData.get('nombre'),
    cliente: formData.get('cliente'),
    ciudad: formData.get('ciudad'),
    fraccionamiento: formData.get('fraccionamiento'),
    paquete: formData.get('paquete'),
    ubicacion: formData.get('ubicacion'),
    estado: formData.get('estado') || 'activa',
    presupuesto_mxn: formData.get('presupuesto_mxn'),
    topes_json: '[]',
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const { topes: _topes, ...obraData } = parsed.data
  const supabase = await createClient()

  // 1. Intentar edición mediante RPC (Migración 0016)
  const { error: rpcError } = await supabase.rpc('editar_proyecto', { p_id: obraId, p_datos: obraData })
  if (!rpcError) {
    revalidatePath('/')
    revalidatePath(`/obras/${obraId}`)
    redirect(`/obras/${obraId}`)
  }

  if (rpcError && !esRelacionAusente(rpcError)) {
    logger.error('Error al editar proyecto mediante RPC', { error: rpcError, obraId, obraData })
    return {
      error: rpcError.message || 'No se pudo editar el proyecto. Si está cerrado, solicita su reapertura.',
    }
  }

  // 2. Fallback de compatibilidad si la RPC 0016 aún no existe
  const { error: errorUpdate } = await supabase
    .from('obras')
    .update({
      ...obraData,
      cerrado_en: obraData.estado === 'cerrada' ? new Date().toISOString() : null,
    })
    .eq('id', obraId)

  if (errorUpdate) {
    logger.error('Error al actualizar proyecto (fallback directo)', { error: errorUpdate, obraId, obraData })
    return { error: errorUpdate.message || 'No se pudo actualizar el proyecto. Intenta de nuevo.' }
  }

  revalidatePath('/')
  revalidatePath(`/obras/${obraId}`)
  redirect(`/obras/${obraId}`)
}
