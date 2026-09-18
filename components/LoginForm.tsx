'use client'

import { useActionState, useState } from 'react'
import { loginAction } from '@/lib/actions/auth'
import { FormError } from '@/components/FormError'
import { IconOjo } from '@/components/icons'
import { SubmitButton } from '@/components/SubmitButton'

const initialState = { error: null as string | null }

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(loginAction, initialState)
  const [verPassword, setVerPassword] = useState(false)

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <FormError message={state.error} />
      <div>
        <label htmlFor="email" className="field-label">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className="input-base"
          placeholder="nombre@empresa.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="field-label">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={verPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="input-base pr-12"
          />
          <button
            type="button"
            onClick={() => setVerPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={verPassword}
          >
            <IconOjo className="size-5" />
          </button>
        </div>
      </div>
      <SubmitButton>Entrar</SubmitButton>
    </form>
  )
}
