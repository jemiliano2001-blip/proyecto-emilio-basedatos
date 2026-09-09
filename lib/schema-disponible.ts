import { createClient } from '@/lib/supabase/server'

export function esRelacionAusente(error: { message?: string; code?: string }): boolean {
  const code = error.code ?? ''
  const msg = (error.message ?? '').toLowerCase()
  return (
    code === 'PGRST205' ||
    code === 'PGRST202' ||
    code === '42P01' ||
    code === '42883' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the function') ||
    msg.includes('could not find function')
  )
}

export async function traspasosSchemaDisponible(): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.from('traspasos_obra').select('id').limit(1)
  if (!error) return true
  return !esRelacionAusente(error)
}

export async function conciliacionSchemaDisponible(): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('v_conciliacion_obra_presupuesto')
    .select('obra_id')
    .limit(1)
  if (!error) return true
  return !esRelacionAusente(error)
}
