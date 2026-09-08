'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarObras } from '@/lib/roles'
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

  const { data, error } = await supabase.rpc('crear_proyecto_con_presupuesto', {
    p_datos: obraData, p_topes: topes,
  })
  if (error || typeof data !== 'string') {
    return { error: 'No se pudo crear el proyecto con su presupuesto. Revisa los datos o contacta al administrador.' }
  }

  revalidatePath('/')
  redirect(`/obras/${data}`)
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
  const { error } = await supabase.rpc('editar_proyecto', { p_id: obraId, p_datos: obraData })
  if (error) return { error: 'No se pudo editar el proyecto. Si está cerrado, solicita su reapertura.' }
  revalidatePath('/')
  revalidatePath(`/obras/${obraId}`)
  redirect(`/obras/${obraId}`)
}
