'use client'

import { useFormState } from 'react-dom'
import { loginAction } from '@/lib/actions/auth'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'

const initialState = { error: null as string | null }

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState(loginAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormError message={state.error} />
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input-base"
          placeholder="tu@correo.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input-base"
        />
      </div>
      <SubmitButton>Entrar</SubmitButton>
    </form>
  )
}
