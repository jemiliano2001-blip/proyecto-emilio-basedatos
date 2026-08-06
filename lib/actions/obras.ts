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

  const supabase = createClient()
  const { topes, ...obraData } = parsed.data

  const { data, error } = await supabase
    .from('obras')
    .insert({
      ...obraData,
      cerrado_en: obraData.estado === 'cerrada' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: 'No se pudo crear el proyecto. Intenta de nuevo.' }
  }

  if (topes.length > 0) {
    const { error: errorTopes } = await supabase.from('obra_material_contratado').insert(
      topes.map((t) => ({
        obra_id: data.id,
        material_id: t.material_id,
        cantidad_contratada: t.cantidad_contratada,
      }))
    )
    if (errorTopes) {
      await supabase.from('obras').delete().eq('id', data.id)
      if (errorTopes.code === '23505') {
        return { error: 'Hay materiales duplicados en el presupuesto.' }
      }
      return {
        error: 'No se pudo guardar el presupuesto de materiales. Intenta de nuevo.',
      }
    }
  }

  revalidatePath('/')
  redirect(`/obras/${data.id}`)
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
  const supabase = createClient()
  const { error } = await supabase
    .from('obras')
    .update({
      ...obraData,
      cerrado_en: obraData.estado === 'cerrada' ? new Date().toISOString() : null,
    })
    .eq('id', obraId)

  if (error) {
    return { error: 'No se pudo actualizar el proyecto. Intenta de nuevo.' }
  }

  revalidatePath('/')
  revalidatePath(`/obras/${obraId}`)
  redirect(`/obras/${obraId}`)
}
