'use client'

import { useActionState } from 'react'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import type { UsuarioActionResult } from '@/lib/actions/usuarios'

export function UsuarioProyectosForm({ proyectos, asignados, action }: {
  proyectos: { id: string; nombre: string; estado: string }[]
  asignados: string[]
  action: (prev: UsuarioActionResult, data: FormData) => Promise<UsuarioActionResult>
}) {
  const [state, formAction] = useActionState(action, { error: null })
  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-muted-foreground">Personal puede trabajar en varios proyectos. Sin asignaciones no podrá solicitar, recibir, instalar ni traspasar material.</p>
      <FormError message={state.error} />
      {state.ok && <p role="status" className="text-sm text-primary">Asignaciones guardadas.</p>}
      <fieldset className="space-y-1 max-h-80 overflow-auto">
        <legend className="sr-only">Proyectos asignados</legend>
        {proyectos.map(proyecto => (
          <label key={proyecto.id} className="flex min-h-[44px] items-center gap-3 rounded-lg px-2 hover:bg-muted">
            <input type="checkbox" name="obra_id" value={proyecto.id} defaultChecked={asignados.includes(proyecto.id)} className="size-4" />
            <span className="text-sm">{proyecto.nombre} <span className="text-muted-foreground">· {proyecto.estado}</span></span>
          </label>
        ))}
        {proyectos.length === 0 && <p className="text-sm text-muted-foreground">No hay proyectos registrados.</p>}
      </fieldset>
      <SubmitButton>Guardar proyectos asignados</SubmitButton>
    </form>
  )
}
