'use client'

import { useEffect, useRef, useState } from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/lib/actions/materiales'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import { PhotoUploadInput } from '@/components/PhotoUploadInput'
import { useModalFocus } from '@/lib/hooks/useModalFocus'
import type { CatalogoMaterial, MaterialCategoria } from '@/lib/types'

const initialState: ActionResult = { error: null }

interface CamposMaterial {
  nombre_base: string
  variante: string
  unidad_medida: string
  categoria: string
  subcategoria: string
  especificacion: string
  precio_base: string
  activo: string
}

function camposIniciales(
  material: CatalogoMaterial | undefined,
  initialCategoria: string | undefined,
  initialSubcategoria: string | undefined
): CamposMaterial {
  return {
    nombre_base: material?.nombre_base ?? '',
    variante: material?.variante ?? '',
    unidad_medida: material?.unidad_medida ?? '',
    categoria: material?.categoria ?? initialCategoria ?? '',
    subcategoria: material?.subcategoria ?? initialSubcategoria ?? '',
    especificacion: material?.especificacion ?? '',
    precio_base:
      material?.precio_base !== undefined && material.precio_base !== null
        ? String(material.precio_base)
        : '0.00',
    activo: material ? (material.activo ? 'true' : 'false') : 'true',
  }
}

function mismoPrecio(a: string, b: string): boolean {
  if (a === b) return true
  const left = Number(a)
  const right = Number(b)
  return a.trim() !== '' && b.trim() !== '' && Number.isFinite(left) && Number.isFinite(right) && left === right
}

function mismosCampos(a: CamposMaterial, b: CamposMaterial): boolean {
  return (
    a.nombre_base === b.nombre_base &&
    a.variante === b.variante &&
    a.unidad_medida === b.unidad_medida &&
    a.categoria === b.categoria &&
    a.subcategoria === b.subcategoria &&
    a.especificacion === b.especificacion &&
    mismoPrecio(a.precio_base, b.precio_base) &&
    a.activo === b.activo
  )
}

function destinoInterno(anchor: HTMLAnchorElement): string | null {
  const raw = anchor.getAttribute('href')
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return null
  let url: URL
  try {
    url = new URL(anchor.href, window.location.href)
  } catch {
    return null
  }
  if (url.origin !== window.location.origin) return null
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null
  return `${url.pathname}${url.search}${url.hash}`
}

export function MaterialForm({
  action,
  material,
  submitLabel,
  categorias = [],
  initialCategoria,
  initialSubcategoria,
  cancelHref,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  material?: CatalogoMaterial
  submitLabel: string
  categorias?: MaterialCategoria[]
  initialCategoria?: string
  initialSubcategoria?: string
  cancelHref?: string
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(action, initialState)
  const [campos, setCampos] = useState(() =>
    camposIniciales(material, initialCategoria, initialSubcategoria)
  )
  const [fotoNueva, setFotoNueva] = useState(false)
  const [fotoEliminada, setFotoEliminada] = useState(false)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const destinoPendiente = useRef<string | null>(null)
  const salirPermitido = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const seguirRef = useRef<HTMLButtonElement>(null)
  const inicial = camposIniciales(material, initialCategoria, initialSubcategoria)
  const sucio =
    fotoNueva || (fotoEliminada && Boolean(material?.foto_url)) || !mismosCampos(campos, inicial)

  useModalFocus(confirmarSalida, dialogRef, seguirRef)

  useEffect(() => {
    if (state.error) salirPermitido.current = false
  }, [state.error])

  useEffect(() => {
    if (!sucio) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (salirPermitido.current) return
      event.preventDefault()
      event.returnValue = ''
    }

    const onClick = (event: MouseEvent) => {
      if (salirPermitido.current || event.defaultPrevented) return
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const destino = destinoInterno(anchor)
      if (!destino) return
      event.preventDefault()
      event.stopPropagation()
      destinoPendiente.current = destino
      setConfirmarSalida(true)
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [sucio])

  function pedirSalida(href: string) {
    if (salirPermitido.current || !sucio) {
      salirPermitido.current = true
      router.push(href)
      return
    }
    destinoPendiente.current = href
    setConfirmarSalida(true)
  }

  function seguirEditando() {
    destinoPendiente.current = null
    setConfirmarSalida(false)
  }

  function descartarYSalir() {
    const href = destinoPendiente.current
    if (!href) {
      seguirEditando()
      return
    }
    salirPermitido.current = true
    setConfirmarSalida(false)
    router.push(href)
  }

  const catActual = categorias.find((c) => c.nombre === campos.categoria)
  const subcats = catActual?.material_subcategorias?.map((s) => s.nombre) ?? []

  return (
    <>
      <form
        action={formAction}
        className="space-y-4"
        onSubmit={() => {
          salirPermitido.current = true
        }}
      >
        <FormError message={state.error} />
        <div>
          <label htmlFor="nombre_base" className="block text-sm font-medium text-foreground mb-1">
            Nombre base *
          </label>
          <input
            id="nombre_base"
            name="nombre_base"
            required
            value={campos.nombre_base}
            onChange={(e) => setCampos((prev) => ({ ...prev, nombre_base: e.target.value }))}
            className="input-base"
            placeholder="ej. Tubo Conduit PAD 2 pulgadas"
          />
        </div>
        <div>
          <label htmlFor="variante" className="block text-sm font-medium text-foreground mb-1">
            Variante
          </label>
          <input
            id="variante"
            name="variante"
            value={campos.variante}
            onChange={(e) => setCampos((prev) => ({ ...prev, variante: e.target.value }))}
            className="input-base"
            placeholder="Opcional (ej. RD 13.5, 75 kVA, Calibre 1/0)"
          />
        </div>
        <div>
          <label htmlFor="unidad_medida" className="block text-sm font-medium text-foreground mb-1">
            Unidad de medida *
          </label>
          <input
            id="unidad_medida"
            name="unidad_medida"
            required
            value={campos.unidad_medida}
            onChange={(e) => setCampos((prev) => ({ ...prev, unidad_medida: e.target.value }))}
            className="input-base"
            placeholder="PZA, MTS, KG, LOTE…"
          />
        </div>
        <div>
          <label htmlFor="categoria" className="block text-sm font-medium text-foreground mb-1">
            Categoría
          </label>
          <select
            id="categoria"
            name="categoria"
            value={campos.categoria}
            onChange={(e) => {
              const categoria = e.target.value
              setCampos((prev) => ({ ...prev, categoria, subcategoria: '' }))
            }}
            className="input-base"
          >
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="subcategoria" className="block text-sm font-medium text-foreground mb-1">
            Subcategoría
          </label>
          <select
            id="subcategoria"
            name="subcategoria"
            value={campos.subcategoria}
            onChange={(e) => setCampos((prev) => ({ ...prev, subcategoria: e.target.value }))}
            className="input-base"
            disabled={!campos.categoria || subcats.length === 0}
          >
            <option value="">
              {!campos.categoria
                ? 'Elige categoría primero'
                : subcats.length === 0
                  ? 'Esta categoría no tiene subcategorías'
                  : 'Sin subcategoría'}
            </option>
            {subcats.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="especificacion" className="block text-sm font-medium text-foreground mb-1">
            Especificación
          </label>
          <textarea
            id="especificacion"
            name="especificacion"
            rows={3}
            value={campos.especificacion}
            onChange={(e) => setCampos((prev) => ({ ...prev, especificacion: e.target.value }))}
            className="input-base"
            placeholder="Normas CFE, fichas técnicas o notas adicionales..."
          />
        </div>
        <div>
          <label htmlFor="precio_base" className="block text-sm font-medium text-foreground mb-1">
            Precio base de referencia (MXN)
          </label>
          <input
            id="precio_base"
            name="precio_base"
            type="number"
            step="0.01"
            min="0"
            value={campos.precio_base}
            onChange={(e) => setCampos((prev) => ({ ...prev, precio_base: e.target.value }))}
            className="input-base"
            placeholder="0.00"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Costo base unitario estimado utilizado para calcular el presupuesto en proyectos.
          </p>
        </div>

        <PhotoUploadInput
          id="foto"
          name="foto"
          label="Foto del material"
          existingUrl={material?.foto_url}
          captureCamera
          onChangeFile={(file) => setFotoNueva(file !== null)}
          onRemoveExisting={setFotoEliminada}
        />

        <div>
          <label htmlFor="activo" className="block text-sm font-medium text-foreground mb-1">
            Activo
          </label>
          <select
            id="activo"
            name="activo"
            value={campos.activo}
            onChange={(e) => setCampos((prev) => ({ ...prev, activo: e.target.value }))}
            className="input-base"
          >
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Activo = sí aparece en el catálogo y se puede usar en obras; No = queda oculto del catálogo sin borrarlo.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton className="w-full sm:flex-1">{submitLabel}</SubmitButton>
          {cancelHref && (
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={() => pedirSalida(cancelHref)}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {confirmarSalida && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
          onClick={seguirEditando}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="salir-sin-guardar-titulo"
            className="card w-full max-w-sm shadow-elevated"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                seguirEditando()
              }
            }}
          >
            <h2 id="salir-sin-guardar-titulo" className="text-lg font-bold text-foreground">
              ¿Salir sin guardar?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Si sales ahora, se pierden los cambios de este material.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                ref={seguirRef}
                type="button"
                className="btn-primary w-full sm:flex-1"
                onClick={seguirEditando}
              >
                Seguir editando
              </button>
              <button type="button" className="btn-danger w-full sm:w-auto" onClick={descartarYSalir}>
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
