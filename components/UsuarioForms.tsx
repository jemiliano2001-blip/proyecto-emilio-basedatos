'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import { IconCopy, IconCheck, IconAlerta } from '@/components/icons'
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
      setTimeout(() => setCopiado(false), 3000)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div
      role="status"
      className="rounded-2xl border border-warning/40 bg-warning-soft/90 p-5 text-sm text-warning-soft-foreground shadow-sm animate-enter"
    >
      <div className="flex items-start gap-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning shadow-2xs">
          <IconAlerta className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">Contraseña temporal (solo se muestra esta vez)</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            Cópiala ahora y compártela de forma segura con la persona. Por seguridad no volverá a mostrarse.
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <code className="rounded-xl bg-card px-3.5 py-2 font-mono text-sm font-bold tracking-wider text-foreground break-all border border-border shadow-xs select-all">
              {password}
            </code>
            <button
              type="button"
              onClick={() => void copiar()}
              className="btn-secondary btn-sm"
            >
              {copiado ? (
                <>
                  <IconCheck className="size-3.5 text-success" />
                  <span className="text-success font-bold">¡Copiada!</span>
                </>
              ) : (
                <>
                  <IconCopy className="size-3.5 text-muted-foreground" />
                  <span>Copiar</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="btn-ghost btn-sm"
            >
              Entendido
            </button>
          </div>
        </div>
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
            <label htmlFor="email" className="field-label">
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
            <label htmlFor="nombre" className="field-label">
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
            <label htmlFor="rol" className="field-label">
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
            <label htmlFor="password" className="field-label">
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
        <label htmlFor="email" className="field-label">
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
        <p className="field-hint">
          Modificar el correo actualiza tanto el perfil como el usuario de inicio de sesión.
        </p>
      </div>
      <div>
        <label htmlFor="nombre" className="field-label">
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
        <label htmlFor="rol" className="field-label">
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
