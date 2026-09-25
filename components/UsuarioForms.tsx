'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import { IconCopy } from '@/components/icons'
import type { UsuarioActionResult } from '@/lib/actions/usuarios'
import { ROLES_USUARIO, etiquetaRol } from '@/lib/validations/usuarios'
import type { RolUsuario, Usuario } from '@/lib/types'

const initialState: UsuarioActionResult = { error: null }

function PasswordBanner({
  password,
  onDismiss,
}: {
  password: string
  onDismiss: () => void
}) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(password)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div
      role="status"
      className="rounded-xl border border-warning/40 bg-warning-soft px-3.5 py-3 text-sm text-warning-soft-foreground"
    >
      <p className="font-bold">Contraseña temporal (solo esta vez)</p>
      <p className="mt-1 text-warning-soft-foreground/80">
        Cópiala y pásasela a la persona. No se vuelve a mostrar.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-card px-2.5 py-1.5 font-mono text-sm break-all border border-warning/30">
          {password}
        </code>
        <button
          type="button"
          onClick={() => void copiar()}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-warning/40 bg-card px-3 text-sm font-semibold text-foreground hover:bg-warning-soft"
        >
          <IconCopy className="h-4 w-4" />
          {copiado ? 'Copiada' : 'Copiar'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[44px] px-3 text-sm font-semibold text-warning-soft-foreground/70 hover:underline"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}

export function UsuarioCrearForm({
  action,
}: {
  action: (prev: UsuarioActionResult, formData: FormData) => Promise<UsuarioActionResult>
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(action, initialState)
  const [bannerPwd, setBannerPwd] = useState<string | null>(null)

  useEffect(() => {
    if (state.ok && state.passwordTemporal) {
      setBannerPwd(state.passwordTemporal)
    } else if (state.ok && state.usuarioId && !state.passwordTemporal) {
      router.push('/usuarios')
      router.refresh()
    }
  }, [state, router])

  return (
    <div className="space-y-4">
      {bannerPwd && (
        <PasswordBanner
          password={bannerPwd}
          onDismiss={() => {
            setBannerPwd(null)
            router.push('/usuarios')
            router.refresh()
          }}
        />
      )}
      {!bannerPwd && (
        <form action={formAction} className="space-y-4">
          <FormError message={state.error} />
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="off"
              className="input-base"
              placeholder="persona@empresa.com"
            />
          </div>
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-foreground mb-1">
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              required
              className="input-base"
              placeholder="Nombre completo"
            />
          </div>
          <div>
            <label htmlFor="rol" className="block text-sm font-medium text-foreground mb-1">
              Rol
            </label>
            <select id="rol" name="rol" required defaultValue="personal" className="input-base">
              {ROLES_USUARIO.map((rol) => (
                <option key={rol} value={rol}>
                  {etiquetaRol(rol)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              Contraseña (opcional)
            </label>
            <input
              id="password"
              name="password"
              type="text"
              autoComplete="new-password"
              className="input-base"
              placeholder="Déjala vacía para generar una temporal"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Si la dejas vacía, generamos una temporal y te la mostramos una sola vez.
            </p>
          </div>
          <SubmitButton>Crear usuario</SubmitButton>
        </form>
      )}
      {bannerPwd && state.usuarioId && (
        <Link
          href={`/usuarios/${state.usuarioId}`}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-primary hover:underline"
        >
          Ver ficha del usuario
        </Link>
      )}
    </div>
  )
}

export function UsuarioEditarForm({
  usuario,
  action,
  esYo,
}: {
  usuario: Usuario
  action: (prev: UsuarioActionResult, formData: FormData) => Promise<UsuarioActionResult>
  esYo: boolean
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(action, initialState)

  useEffect(() => {
    if (state.ok) {
      router.refresh()
    }
  }, [state, router])

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      {state.ok && !state.error && (
        <p className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success-soft-foreground">
          Cambios guardados.
        </p>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
          Correo de acceso
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={usuario.email ?? ''}
          className="input-base"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Modificar el correo actualiza tanto el perfil como el usuario de inicio de sesión.
        </p>
      </div>
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium text-foreground mb-1">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          defaultValue={usuario.nombre}
          className="input-base"
        />
      </div>
      <div>
        <label htmlFor="rol" className="block text-sm font-medium text-foreground mb-1">
          Rol
        </label>
        <select
          id="rol"
          name="rol"
          required
          defaultValue={usuario.rol}
          className="input-base"
        >
          {ROLES_USUARIO.map((rol: RolUsuario) => (
            <option key={rol} value={rol}>
              {etiquetaRol(rol)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="activo" className="block text-sm font-medium text-foreground mb-1">
          Activo
        </label>
        <select
          id="activo"
          name="activo"
          defaultValue={usuario.activo ? 'true' : 'false'}
          className="input-base"
          disabled={esYo}
        >
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
        {esYo && (
          <>
            <input type="hidden" name="activo" value="true" />
            <p className="mt-1 text-xs text-muted-foreground">No puedes desactivar tu propia cuenta.</p>
          </>
        )}
      </div>
      <SubmitButton>Guardar cambios</SubmitButton>
    </form>
  )
}

export function UsuarioResetPasswordForm({
  action,
}: {
  action: (prev: UsuarioActionResult, formData: FormData) => Promise<UsuarioActionResult>
}) {
  const [state, formAction] = useActionState(action, initialState)
  const [bannerPwd, setBannerPwd] = useState<string | null>(null)

  useEffect(() => {
    if (state.ok && state.passwordTemporal) {
      setBannerPwd(state.passwordTemporal)
    }
  }, [state])

  return (
    <div className="space-y-4">
      {bannerPwd && (
        <PasswordBanner password={bannerPwd} onDismiss={() => setBannerPwd(null)} />
      )}
      <form action={formAction} className="space-y-4">
        <FormError message={state.error} />
        <div>
          <label htmlFor="password-reset" className="block text-sm font-medium text-foreground mb-1">
            Nueva contraseña (opcional)
          </label>
          <input
            id="password-reset"
            name="password"
            type="text"
            autoComplete="new-password"
            className="input-base"
            placeholder="Vacía = generar temporal"
          />
        </div>
        <SubmitButton>Restablecer contraseña</SubmitButton>
      </form>
    </div>
  )
}
