'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarProveedores } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateProveedorInput } from '@/lib/validations/proveedor'

export type ActionResult = { error: string | null; ok?: boolean }

export async function createProveedorAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarProveedores(session.rol)) {
    return { error: 'No tienes permiso para crear proveedores.' }
  }

  const parsed = validateProveedorInput({
    nombre: formData.get('nombre'),
    contacto: formData.get('contacto'),
    telefono: formData.get('telefono'),
    activo: true,
  })

  if (!parsed.ok) return { error: parsed.error }

  const supabase = createClient()
  const { error } = await supabase.from('proveedores').insert(parsed.data)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe un proveedor con ese nombre.' }
    }
    return { error: 'No se pudo crear el proveedor. Intenta de nuevo.' }
  }

  revalidatePath('/proveedores')
  redirect('/proveedores')
}

export async function updateProveedorAction(
  proveedorId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarProveedores(session.rol)) {
    return { error: 'No tienes permiso para editar proveedores.' }
  }

  const parsed = validateProveedorInput({
    nombre: formData.get('nombre'),
    contacto: formData.get('contacto'),
    telefono: formData.get('telefono'),
    activo: formData.get('activo') !== 'false',
  })

  if (!parsed.ok) return { error: parsed.error }

  const supabase = createClient()
  const { error } = await supabase
    .from('proveedores')
    .update(parsed.data)
    .eq('id', proveedorId)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe un proveedor con ese nombre.' }
    }
    return { error: 'No se pudo actualizar el proveedor. Intenta de nuevo.' }
  }

  revalidatePath('/proveedores')
  revalidatePath(`/proveedores/${proveedorId}`)
  redirect('/proveedores')
}
